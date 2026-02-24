package services

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	reParensText = regexp.MustCompile(`\(([^()]*)\)`)
)

// ExtractTextFromUploadedPDF reads a PDF under /uploads and returns plain text snippets.
// This is a lightweight best-effort extractor suitable for prompt grounding.
func ExtractTextFromUploadedPDF(fileURL string) (string, error) {
	trimmed := strings.TrimSpace(fileURL)
	if trimmed == "" {
		return "", fmt.Errorf("empty file url")
	}
	if !strings.HasPrefix(trimmed, "/uploads/") {
		return "", fmt.Errorf("unsupported file location")
	}

	fileName := strings.TrimPrefix(trimmed, "/uploads/")
	if fileName == "" || strings.Contains(fileName, "..") || strings.Contains(fileName, "/") {
		return "", fmt.Errorf("invalid upload file path")
	}

	absPath := filepath.Join("uploads", fileName)
	raw, err := os.ReadFile(absPath)
	if err != nil {
		return "", fmt.Errorf("failed to read pdf file: %w", err)
	}

	text := extractTextFromPDFBytes(raw)
	text = compactSpaces(text)
	if text == "" {
		return "", fmt.Errorf("no readable text found in pdf")
	}
	return text, nil
}

func extractTextFromPDFBytes(raw []byte) string {
	lowerRaw := bytes.ToLower(raw)
	var builder strings.Builder

	searchAt := 0
	for {
		streamIdx := bytes.Index(lowerRaw[searchAt:], []byte("stream"))
		if streamIdx < 0 {
			break
		}
		streamStart := searchAt + streamIdx

		dataStart := streamStart + len("stream")
		if dataStart+2 < len(raw) && raw[dataStart] == '\r' && raw[dataStart+1] == '\n' {
			dataStart += 2
		} else if dataStart < len(raw) && (raw[dataStart] == '\n' || raw[dataStart] == '\r') {
			dataStart++
		}

		endIdxRel := bytes.Index(lowerRaw[dataStart:], []byte("endstream"))
		if endIdxRel < 0 {
			break
		}
		dataEnd := dataStart + endIdxRel
		if dataEnd <= dataStart {
			searchAt = dataStart + len("endstream")
			continue
		}

		streamData := raw[dataStart:dataEnd]
		text := tryExtractTextFromStream(streamData)
		if text != "" {
			builder.WriteString(text)
			builder.WriteString("\n")
		}

		searchAt = dataEnd + len("endstream")
	}

	return builder.String()
}

func tryExtractTextFromStream(streamData []byte) string {
	candidates := [][]byte{streamData}

	zr, err := zlib.NewReader(bytes.NewReader(streamData))
	if err == nil {
		defer zr.Close()
		if inflated, readErr := io.ReadAll(zr); readErr == nil && len(inflated) > 0 {
			candidates = append(candidates, inflated)
		}
	}

	var builder strings.Builder
	for _, c := range candidates {
		if len(c) == 0 {
			continue
		}
		if !bytes.Contains(c, []byte("Tj")) && !bytes.Contains(c, []byte("TJ")) {
			continue
		}
		matches := reParensText.FindAllSubmatch(c, -1)
		for _, m := range matches {
			if len(m) < 2 {
				continue
			}
			part := decodePDFString(m[1])
			part = compactSpaces(part)
			if part == "" {
				continue
			}
			builder.WriteString(part)
			builder.WriteString(" ")
		}
	}
	return strings.TrimSpace(builder.String())
}

func decodePDFString(in []byte) string {
	var out bytes.Buffer
	escaped := false
	for _, b := range in {
		if escaped {
			switch b {
			case 'n':
				out.WriteByte('\n')
			case 'r':
				out.WriteByte('\r')
			case 't':
				out.WriteByte('\t')
			case '\\', '(', ')':
				out.WriteByte(b)
			default:
				out.WriteByte(b)
			}
			escaped = false
			continue
		}
		if b == '\\' {
			escaped = true
			continue
		}
		out.WriteByte(b)
	}
	return out.String()
}

func compactSpaces(s string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}
