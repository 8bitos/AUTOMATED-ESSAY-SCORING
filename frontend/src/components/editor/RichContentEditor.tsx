"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlignCenter,
  FiAlignJustify,
  FiAlignLeft,
  FiAlignRight,
  FiEdit2,
  FiFileText,
  FiGrid,
  FiImage,
  FiLink,
  FiList,
  FiMinusSquare,
  FiPlusSquare,
  FiRotateCcw,
  FiRotateCw,
  FiTrash2,
  FiType,
  FiUploadCloud,
} from "react-icons/fi";

type RichContentEditorProps = {
  value: string;
  onChange: (html: string) => void;
  showPreview?: boolean;
  imageMaxSizeMb?: number;
  pdfMaxSizeMb?: number;
  allowPdf?: boolean;
  allowTables?: boolean;
  editorClassName?: string;
};

function TooltipWrap({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeEditorHtml(html: string): string {
  const noScript = (html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .trim();
  return noScript || "<p></p>";
}

function cleanEditorOutput(html: string): string {
  if (typeof document === "undefined") return sanitizeEditorHtml(html);

  const container = document.createElement("div");
  container.innerHTML = sanitizeEditorHtml(html);

  container.querySelectorAll("[data-media-delete='1'], [data-media-hint='1']").forEach((node) => node.remove());

  container.querySelectorAll<HTMLElement>("[data-media-block='1']").forEach((block) => {
    block.removeAttribute("contenteditable");
    block.style.outline = "none";
    block.style.boxShadow = "none";
    block.style.resize = "none";
    block.style.overflow = "visible";
    block.style.border = "0";
    block.style.padding = "0";
    block.style.background = "transparent";
    block.style.minHeight = "";

    block.querySelectorAll<HTMLElement>("iframe, video, embed, object, a").forEach((el) => {
      el.style.pointerEvents = "";
    });
  });

  return sanitizeEditorHtml(container.innerHTML);
}

function normalizeEditorNodeDirection(root: HTMLDivElement): void {
  root.setAttribute("dir", "ltr");
  root.style.direction = "ltr";
  root.style.unicodeBidi = "normal";
  root.style.writingMode = "horizontal-tb";
  root.style.textAlign = "left";

  root.querySelectorAll<HTMLElement>("p, div, li, td, th, h1, h2, h3, h4, h5, h6, blockquote").forEach((el) => {
    if (el.getAttribute("data-media-block") === "1") return;
    el.setAttribute("dir", "ltr");
    el.style.direction = "ltr";
    el.style.unicodeBidi = "normal";
    el.style.writingMode = "horizontal-tb";
  });

  root.querySelectorAll<HTMLElement>("[dir='rtl'], [dir='auto']").forEach((el) => {
    el.setAttribute("dir", "ltr");
  });

  root.querySelectorAll<HTMLElement>("[style*='direction'], [style*='unicode-bidi'], [style*='writing-mode']").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const cleaned = style
      .replace(/direction\s*:\s*rtl\s*;?/gi, "")
      .replace(/unicode-bidi\s*:\s*(bidi-override|plaintext|isolate-override)\s*;?/gi, "")
      .replace(/writing-mode\s*:\s*[^;]+;?/gi, "")
      .trim();
    if (cleaned) {
      el.setAttribute("style", cleaned);
    } else {
      el.removeAttribute("style");
    }
  });
}

function normalizeEmbedUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/i);
  if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const ytShortsMatch = trimmed.match(/youtube\.com\/shorts\/([^&?/]+)/i);
  if (ytShortsMatch?.[1]) return `https://www.youtube.com/embed/${ytShortsMatch[1]}`;
  return trimmed;
}

function toAbsoluteUploadUrl(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/${trimmed.replace(/^\/+/, "")}`;
  }
  return trimmed;
}

export default function RichContentEditor({
  value,
  onChange,
  showPreview = false,
  imageMaxSizeMb = 10,
  pdfMaxSizeMb = 5,
  allowPdf = true,
  allowTables = true,
  editorClassName = "min-h-[320px] max-h-[58vh]",
}: RichContentEditorProps) {
  const [editorHtml, setEditorHtml] = useState(sanitizeEditorHtml(value || "<p></p>"));
  const [textColor, setTextColor] = useState("#111827");
  const [fontSizePx, setFontSizePx] = useState(16);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const hoveredMediaRef = useRef<HTMLDivElement | null>(null);
  const selectedMediaRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastExternalValueRef = useRef<string>(sanitizeEditorHtml(value || "<p></p>"));

  const mediaDeleteButtonHtml =
    `<button data-media-delete="1" type="button" style="display:none;position:absolute;top:6px;right:6px;width:24px;height:24px;border:1px solid #fecaca;border-radius:999px;background:#fff;color:#b91c1c;font-weight:700;line-height:1;align-items:center;justify-content:center;cursor:pointer;z-index:5;" title="Hapus media">×</button>`;
  const mediaResizeHintHtml =
    `<div data-media-hint="1" style="position:absolute;right:8px;bottom:6px;font-size:11px;color:#64748b;pointer-events:none;">◢ drag</div>`;

  const emitHtmlChange = useCallback(
    (html: string) => {
      const normalized = cleanEditorOutput(html);
      setEditorHtml(normalized);
      onChange(normalized);
    },
    [onChange],
  );

  const pushHistorySnapshot = useCallback((html: string) => {
    const normalized = sanitizeEditorHtml(html);
    const history = historyRef.current;
    if (history.length === 0 || history[history.length - 1] !== normalized) {
      history.push(normalized);
      if (history.length > 200) history.shift();
    }
  }, []);

  const showMediaDeleteButton = useCallback((media: HTMLDivElement | null, visible: boolean) => {
    if (!media) return;
    const btn = media.querySelector<HTMLElement>("[data-media-delete='1']");
    if (!btn) return;
    btn.style.display = visible ? "inline-flex" : "none";
  }, []);

  const applyMediaSelectedStyle = useCallback((media: HTMLDivElement | null, selected: boolean) => {
    if (!media) return;
    media.style.outline = selected ? "2px solid #2563eb" : "none";
    media.style.boxShadow = selected ? "0 0 0 3px rgba(37,99,235,0.15)" : "none";
  }, []);

  const setSelectedMedia = useCallback((media: HTMLDivElement | null) => {
    if (selectedMediaRef.current && selectedMediaRef.current !== media) {
      applyMediaSelectedStyle(selectedMediaRef.current, false);
      if (selectedMediaRef.current !== hoveredMediaRef.current) {
        showMediaDeleteButton(selectedMediaRef.current, false);
      }
    }
    selectedMediaRef.current = media;
    if (media) {
      applyMediaSelectedStyle(media, true);
      showMediaDeleteButton(media, true);
    }
  }, [applyMediaSelectedStyle, showMediaDeleteButton]);

  const setHoveredMedia = useCallback((media: HTMLDivElement | null) => {
    if (hoveredMediaRef.current && hoveredMediaRef.current !== media && hoveredMediaRef.current !== selectedMediaRef.current) {
      showMediaDeleteButton(hoveredMediaRef.current, false);
    }
    hoveredMediaRef.current = media;
    if (media) showMediaDeleteButton(media, true);
  }, [showMediaDeleteButton]);

  const ensureMediaBlocksEditableBehavior = useCallback((editor: HTMLDivElement | null) => {
    if (!editor) return;
    const mediaBlocks = editor.querySelectorAll<HTMLDivElement>("[data-media-block='1']");
    mediaBlocks.forEach((block) => {
      block.setAttribute("contenteditable", "false");
      block.setAttribute("draggable", "false");
      block.style.position = "relative";
      block.style.resize = "both";
      block.style.overflow = "auto";
      block.style.border = "1px dashed #cbd5e1";
      block.style.borderRadius = "10px";
      block.style.padding = "6px";
      if (!block.style.width) {
        block.style.width = "420px";
      }
      if (!block.style.maxWidth) {
        block.style.maxWidth = "100%";
      }
      if (!block.style.marginLeft && !block.style.marginRight) {
        block.style.margin = "8px auto 8px 0";
      }
      if (block.querySelector("iframe")) {
        block.style.background = "#f8fafc";
      }

      let deleteBtn = block.querySelector<HTMLElement>("[data-media-delete='1']");
      if (!deleteBtn) {
        block.insertAdjacentHTML("afterbegin", mediaDeleteButtonHtml);
        deleteBtn = block.querySelector<HTMLElement>("[data-media-delete='1']");
      }
      if (deleteBtn) {
        deleteBtn.style.zIndex = "8";
        deleteBtn.style.pointerEvents = "auto";
      }

      let resizeHint = block.querySelector<HTMLElement>("[data-media-hint='1']");
      if (!resizeHint) {
        block.insertAdjacentHTML("beforeend", mediaResizeHintHtml);
        resizeHint = block.querySelector<HTMLElement>("[data-media-hint='1']");
      }
      if (resizeHint) {
        resizeHint.style.display = "block";
      }

      block.querySelectorAll<HTMLElement>("iframe,video,embed,object").forEach((el) => {
        el.style.pointerEvents = "none";
        el.setAttribute("tabindex", "-1");
        el.setAttribute("draggable", "false");
      });
      block.querySelectorAll<HTMLAnchorElement>("a").forEach((a) => {
        a.style.pointerEvents = "none";
        a.setAttribute("tabindex", "-1");
        a.removeAttribute("target");
        a.setAttribute("draggable", "false");
      });
      block.querySelectorAll<HTMLElement>("img").forEach((img) => {
        img.setAttribute("draggable", "false");
      });
    });
  }, [mediaDeleteButtonHtml, mediaResizeHintHtml]);

  useEffect(() => {
    const initialHtml = sanitizeEditorHtml(value || "<p></p>");
    setEditorHtml(initialHtml);
    const isSameExternalValue = lastExternalValueRef.current === initialHtml;
    if (editorRef.current) {
      const currentNormalized = cleanEditorOutput(editorRef.current.innerHTML);
      if (currentNormalized !== initialHtml) {
        editorRef.current.innerHTML = initialHtml;
        normalizeEditorNodeDirection(editorRef.current);
        ensureMediaBlocksEditableBehavior(editorRef.current);
        historyRef.current = [initialHtml];
        redoRef.current = [];
      }
    }
    if (!isSameExternalValue && !editorRef.current) {
      historyRef.current = [initialHtml];
      redoRef.current = [];
    }
    lastExternalValueRef.current = initialHtml;
  }, [ensureMediaBlocksEditableBehavior, value]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!toolbarRef.current) return;
      if (!toolbarRef.current.contains(event.target as Node)) {
        setShowFontSizeMenu(false);
        setShowTablePicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const updateSelectionRange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const hostNode = common.nodeType === Node.TEXT_NODE ? common.parentNode : common;
    if (hostNode && editor.contains(hostNode)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const placeCaretAtParagraphEnd = useCallback((paragraph: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();

    paragraph.setAttribute("dir", "ltr");
    paragraph.style.direction = "ltr";
    paragraph.style.unicodeBidi = "normal";
    paragraph.style.writingMode = "horizontal-tb";
    paragraph.style.textAlign = "left";

    let textNode = Array.from(paragraph.childNodes).find((node) => node.nodeType === Node.TEXT_NODE) as Text | undefined;
    if (!textNode) {
      paragraph.innerHTML = "";
      textNode = document.createTextNode("");
      paragraph.appendChild(textNode);
    }

    range.setStart(textNode, textNode.textContent?.length || 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }, []);

  const moveCaretAfterMedia = useCallback((media: HTMLDivElement) => {
    const editor = editorRef.current;
    if (!editor || !editor.contains(media)) return;

    let next = media.nextElementSibling as HTMLElement | null;
    if (!next || next.tagName !== "P") {
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      media.insertAdjacentElement("afterend", paragraph);
      next = paragraph;
    }

    next.setAttribute("dir", "ltr");
    next.style.direction = "ltr";
    next.style.unicodeBidi = "normal";
    next.style.textAlign = "left";

    setSelectedMedia(null);
    editor.focus();
    placeCaretAtParagraphEnd(next);
  }, [placeCaretAtParagraphEnd, setSelectedMedia]);

  const applyEditorCommand = useCallback((command: string, valueArg?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRangeRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }
    }
    if (command === "formatBlock" && valueArg) {
      document.execCommand("formatBlock", false, `<${valueArg.toLowerCase()}>`);
    } else {
      document.execCommand(command, false, valueArg);
    }
    normalizeEditorNodeDirection(editor);
    ensureMediaBlocksEditableBehavior(editor);
    updateSelectionRange();
    emitHtmlChange(editor.innerHTML);
    pushHistorySnapshot(editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, ensureMediaBlocksEditableBehavior, pushHistorySnapshot, updateSelectionRange]);

  const insertMediaBlock = useCallback((html: string) => {
    applyEditorCommand("insertHTML", html);
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const mediaBlocks = editor.querySelectorAll<HTMLDivElement>("[data-media-block='1']");
      const latest = mediaBlocks[mediaBlocks.length - 1];
      if (latest) {
        moveCaretAfterMedia(latest);
      }
    }, 0);
  }, [applyEditorCommand, moveCaretAfterMedia]);

  const handleAddLink = useCallback(() => {
    const url = window.prompt("Masukkan URL link:");
    if (!url) return;
    const trimmed = url.trim();
    const youtubeMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/i) || trimmed.match(/youtube\.com\/shorts\/([^&?/]+)/i);
    if (youtubeMatch?.[1]) {
      const embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
      insertMediaBlock(
        `<p><br/></p><div data-media-block="1" contenteditable="false" style="position:relative;resize:both;overflow:auto;width:560px;max-width:100%;min-height:260px;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px auto 8px 0;background:#f8fafc;">
          ${mediaDeleteButtonHtml}
          ${mediaResizeHintHtml}
          <iframe src="${embedUrl}" title="Embedded YouTube" style="width:100%;height:100%;min-height:240px;border:0;border-radius:8px;pointer-events:none;" allowfullscreen></iframe>
        </div><p><br/></p>`,
      );
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      applyEditorCommand("createLink", trimmed);
      return;
    }
    applyEditorCommand("insertHTML", `<a href="${escapeHtml(trimmed)}" target="_blank" rel="noopener noreferrer">${escapeHtml(trimmed)}</a>`);
  }, [applyEditorCommand, insertMediaBlock, mediaDeleteButtonHtml, mediaResizeHintHtml]);

  const handleInsertImageByUrl = useCallback(() => {
    const url = window.prompt("Masukkan URL gambar:");
    if (!url) return;
    const safe = escapeHtml(url.trim());
    insertMediaBlock(
      `<p><br/></p><div data-media-block="1" contenteditable="false" style="position:relative;resize:both;overflow:auto;width:420px;max-width:100%;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px auto 8px 0;">
        ${mediaDeleteButtonHtml}
        ${mediaResizeHintHtml}
        <img src="${safe}" alt="Gambar materi" style="width:100%;height:auto;display:block;border-radius:8px;" />
      </div><p><br/></p>`,
    );
  }, [insertMediaBlock, mediaDeleteButtonHtml, mediaResizeHintHtml]);

  const handleUploadImage = useCallback(async (file: File | null) => {
    if (!file) return;
    setError("");
    if (file.size > imageMaxSizeMb * 1024 * 1024) {
      setError(`Ukuran gambar maksimal ${imageMaxSizeMb}MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.filePath) {
        throw new Error(body?.message || "Gagal upload gambar.");
      }
      const safePath = escapeHtml(toAbsoluteUploadUrl(String(body.filePath || "")));
      insertMediaBlock(
        `<p><br/></p><div data-media-block="1" contenteditable="false" style="position:relative;resize:both;overflow:auto;width:420px;max-width:100%;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px auto 8px 0;">
          ${mediaDeleteButtonHtml}
          ${mediaResizeHintHtml}
          <img src="${safePath}" alt="Gambar materi" style="width:100%;height:auto;display:block;border-radius:8px;" />
        </div><p><br/></p>`,
      );
    } catch (err: any) {
      setError(err?.message || "Gagal upload gambar.");
    } finally {
      setUploading(false);
    }
  }, [imageMaxSizeMb, insertMediaBlock, mediaDeleteButtonHtml, mediaResizeHintHtml]);

  const handleUploadPdf = useCallback(async (file: File | null) => {
    if (!file) return;
    setError("");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("File harus berformat PDF.");
      return;
    }
    if (file.size > pdfMaxSizeMb * 1024 * 1024) {
      setError(`Ukuran PDF maksimal ${pdfMaxSizeMb}MB.`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.filePath) {
        throw new Error(body?.message || "Gagal upload PDF.");
      }
      const safePath = escapeHtml(toAbsoluteUploadUrl(String(body.filePath || "")));
      insertMediaBlock(
        `<p><br/></p><div data-media-block="1" contenteditable="false" style="position:relative;resize:both;overflow:auto;width:520px;max-width:100%;min-height:220px;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px auto 8px 0;background:#f8fafc;">
          ${mediaDeleteButtonHtml}
          ${mediaResizeHintHtml}
          <iframe src="${safePath}" title="PDF Materi" style="width:100%;height:100%;min-height:200px;border:0;border-radius:8px;pointer-events:none;"></iframe>
          <div style="margin-top:6px;font-size:12px;color:#475569;">Preview PDF (non-interaktif saat mode edit)</div>
        </div><p><br/></p>`,
      );
    } catch (err: any) {
      setError(err?.message || "Gagal upload PDF.");
    } finally {
      setUploading(false);
    }
  }, [insertMediaBlock, mediaDeleteButtonHtml, mediaResizeHintHtml, pdfMaxSizeMb]);

  const alignSelectedMedia = useCallback((position: "left" | "center" | "right") => {
    const selected = selectedMediaRef.current;
    const editor = editorRef.current;
    if (!selected || !editor || !editor.contains(selected)) return;
    if (position === "left") {
      selected.style.marginLeft = "0";
      selected.style.marginRight = "auto";
    } else if (position === "center") {
      selected.style.marginLeft = "auto";
      selected.style.marginRight = "auto";
    } else {
      selected.style.marginLeft = "auto";
      selected.style.marginRight = "0";
    }
    emitHtmlChange(editor.innerHTML);
    pushHistorySnapshot(editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, pushHistorySnapshot]);

  const removeSelectedMediaBlock = useCallback(() => {
    const editor = editorRef.current;
    const media = selectedMediaRef.current;
    if (!editor || !media || !editor.contains(media)) return;
    const prev = media.previousElementSibling as HTMLElement | null;
    const next = media.nextElementSibling as HTMLElement | null;
    media.remove();
    if (prev && prev.tagName === "P" && (prev.textContent || "").trim() === "") prev.remove();
    if (next && next.tagName === "P" && (next.textContent || "").trim() === "") next.remove();
    setSelectedMedia(null);
    setHoveredMedia(null);
    emitHtmlChange(editor.innerHTML);
    pushHistorySnapshot(editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, pushHistorySnapshot, setHoveredMedia, setSelectedMedia]);

  const getTableContext = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const host = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
    const cell = host?.closest("td,th") as HTMLTableCellElement | null;
    const table = host?.closest("table") as HTMLTableElement | null;
    if (!cell || !table || !editor.contains(table)) return null;
    const row = cell.parentElement as HTMLTableRowElement | null;
    if (!row) return null;
    return { editor, table, row, rowIndex: row.rowIndex, cellIndex: cell.cellIndex };
  }, []);

  const insertTableAtSelection = useCallback((rows: number, cols: number) => {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 || rows > 20 || cols > 10) {
      setError("Ukuran tabel tidak valid. Maksimal 20x10.");
      return;
    }
    const headerCells = Array.from({ length: cols }, (_, i) => `<th data-editor-table-cell="1" style="border:1px solid #cbd5e1;padding:8px;background:#f8fafc;">Kolom ${i + 1}</th>`).join("");
    const bodyRows = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => `<td data-editor-table-cell="1" style="border:1px solid #cbd5e1;padding:8px;">&nbsp;</td>`).join("")}</tr>`).join("");
    const tableHtml = `<div data-editor-table-wrap="1" style="position:relative;resize:both;overflow:auto;width:100%;max-width:100%;border:1px dashed #cbd5e1;border-radius:10px;padding:6px;margin:8px 0;background:#fff;">
      <table data-editor-table="1" style="border-collapse:collapse;width:100%;margin:0;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
      ${mediaResizeHintHtml}
    </div><p></p>`;
    applyEditorCommand("insertHTML", tableHtml);
    setShowTablePicker(false);
    setTableHover({ rows: 0, cols: 0 });
  }, [applyEditorCommand, mediaResizeHintHtml]);

  const handleAddTableRow = useCallback(() => {
    const ctx = getTableContext();
    if (!ctx) return;
    const colCount = ctx.row.cells.length || 1;
    const newRow = ctx.table.insertRow(ctx.rowIndex + 1);
    for (let i = 0; i < colCount; i++) {
      const td = newRow.insertCell();
      td.style.border = "1px solid #cbd5e1";
      td.style.padding = "8px";
      td.innerHTML = "&nbsp;";
    }
    emitHtmlChange(ctx.editor.innerHTML);
    pushHistorySnapshot(ctx.editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, getTableContext, pushHistorySnapshot]);

  const handleDeleteTableRow = useCallback(() => {
    const ctx = getTableContext();
    if (!ctx) return;
    if (ctx.table.rows.length <= 1) {
      ctx.table.remove();
    } else {
      ctx.table.deleteRow(ctx.rowIndex);
    }
    emitHtmlChange(ctx.editor.innerHTML);
    pushHistorySnapshot(ctx.editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, getTableContext, pushHistorySnapshot]);

  const handleAddTableColumn = useCallback(() => {
    const ctx = getTableContext();
    if (!ctx) return;
    Array.from(ctx.table.rows).forEach((r) => {
      const isHeaderRow = (r.parentElement?.tagName || "").toLowerCase() === "thead" || Array.from(r.cells).some((c) => c.tagName.toLowerCase() === "th");
      const cell = document.createElement(isHeaderRow ? "th" : "td");
      cell.style.border = "1px solid #cbd5e1";
      cell.style.padding = "8px";
      cell.innerHTML = isHeaderRow ? "Kolom Baru" : "&nbsp;";
      if (ctx.cellIndex + 1 >= r.cells.length) {
        r.appendChild(cell);
      } else {
        r.insertBefore(cell, r.cells[ctx.cellIndex + 1]);
      }
    });
    emitHtmlChange(ctx.editor.innerHTML);
    pushHistorySnapshot(ctx.editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, getTableContext, pushHistorySnapshot]);

  const handleDeleteTableColumn = useCallback(() => {
    const ctx = getTableContext();
    if (!ctx) return;
    const colCount = ctx.row.cells.length;
    if (colCount <= 1) {
      ctx.table.remove();
    } else {
      Array.from(ctx.table.rows).forEach((r) => {
        if (ctx.cellIndex < r.cells.length) r.deleteCell(ctx.cellIndex);
      });
    }
    emitHtmlChange(ctx.editor.innerHTML);
    pushHistorySnapshot(ctx.editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, getTableContext, pushHistorySnapshot]);

  const handleDeleteCurrentTable = useCallback(() => {
    const ctx = getTableContext();
    if (!ctx) return;
    ctx.table.remove();
    normalizeEditorNodeDirection(ctx.editor);
    emitHtmlChange(ctx.editor.innerHTML);
    pushHistorySnapshot(ctx.editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, getTableContext, pushHistorySnapshot]);

  const applyFontSize = useCallback((sizePx: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRangeRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    editor.querySelectorAll("font[size='7']").forEach((fontNode) => {
      const span = document.createElement("span");
      span.style.fontSize = `${sizePx}px`;
      span.innerHTML = fontNode.innerHTML;
      fontNode.replaceWith(span);
    });
    normalizeEditorNodeDirection(editor);
    ensureMediaBlocksEditableBehavior(editor);
    updateSelectionRange();
    emitHtmlChange(editor.innerHTML);
    pushHistorySnapshot(editor.innerHTML);
    redoRef.current = [];
  }, [emitHtmlChange, ensureMediaBlocksEditableBehavior, pushHistorySnapshot, updateSelectionRange]);

  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const history = historyRef.current;
    if (history.length <= 1) return;
    const current = history.pop();
    if (current) redoRef.current.push(current);
    const previous = history[history.length - 1] || "<p></p>";
    editor.innerHTML = previous;
    normalizeEditorNodeDirection(editor);
    ensureMediaBlocksEditableBehavior(editor);
    emitHtmlChange(previous);
  }, [emitHtmlChange, ensureMediaBlocksEditableBehavior]);

  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = redoRef.current.pop();
    if (!next) return;
    editor.innerHTML = next;
    normalizeEditorNodeDirection(editor);
    ensureMediaBlocksEditableBehavior(editor);
    emitHtmlChange(next);
    pushHistorySnapshot(next);
  }, [emitHtmlChange, ensureMediaBlocksEditableBehavior, pushHistorySnapshot]);

  const runToolbarAction = useCallback((action: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    action();
  }, []);

  const toolbarButtonClass = "sage-button-outline !px-2 !py-1 text-xs";

  return (
    <div className={showPreview ? "grid gap-4 lg:grid-cols-[1.25fr_1fr]" : "space-y-3"}>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div ref={toolbarRef} className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
            <TooltipWrap label="Bold">
            <button type="button" className={`${toolbarButtonClass} font-bold`} title="Bold" onMouseDown={runToolbarAction(() => applyEditorCommand("bold"))}>B</button>
            </TooltipWrap>
            <TooltipWrap label="Italic">
              <button type="button" className={`${toolbarButtonClass} italic`} title="Italic" onMouseDown={runToolbarAction(() => applyEditorCommand("italic"))}>I</button>
            </TooltipWrap>
            <TooltipWrap label="Underline">
              <button type="button" className={`${toolbarButtonClass} underline`} title="Underline" onMouseDown={runToolbarAction(() => applyEditorCommand("underline"))}>U</button>
            </TooltipWrap>
            <TooltipWrap label="Strikethrough">
              <button type="button" className={`${toolbarButtonClass} line-through`} title="Strikethrough" onMouseDown={runToolbarAction(() => applyEditorCommand("strikeThrough"))}>S</button>
            </TooltipWrap>
            <TooltipWrap label="Hapus link pada teks terpilih">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("unlink"))}>
                <FiLink size={14} className="opacity-60" />
              </button>
            </TooltipWrap>
            <TooltipWrap label="Hapus format teks">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("removeFormat"))}>
                <FiEdit2 size={14} />
              </button>
            </TooltipWrap>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span>Color</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  const next = e.target.value;
                  setTextColor(next);
                  applyEditorCommand("foreColor", next);
                }}
                className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
            </label>
            <div className="relative">
              <button
                type="button"
                className={`${toolbarButtonClass} inline-flex items-center gap-1`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowFontSizeMenu((prev) => !prev);
                  setShowTablePicker(false);
                }}
              >
                <FiType size={14} /> {fontSizePx}px
              </button>
              {showFontSizeMenu && (
                <div className="absolute right-0 top-9 z-20 w-28 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`w-full rounded-md px-2 py-1 text-left text-xs hover:bg-slate-100 ${fontSizePx === size ? "bg-slate-100 font-semibold" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFontSizePx(size);
                        applyFontSize(size);
                        setShowFontSizeMenu(false);
                      }}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              )}
            </div>
            <TooltipWrap label="Sisipkan link atau embed YouTube">
              <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleAddLink)}>
                <FiLink size={14} /> Link
              </button>
            </TooltipWrap>
            <TooltipWrap label="Bullet list">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("insertUnorderedList"))}>
                <FiList size={14} />
              </button>
            </TooltipWrap>
            <TooltipWrap label="Numbered list">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("insertOrderedList"))}>1.</button>
            </TooltipWrap>
            <TooltipWrap label="Rata kiri paragraf">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("justifyLeft"))}><FiAlignLeft size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Rata tengah paragraf">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("justifyCenter"))}><FiAlignCenter size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Rata kanan paragraf">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("justifyRight"))}><FiAlignRight size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Justify paragraf">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => applyEditorCommand("justifyFull"))}><FiAlignJustify size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Sisipkan gambar dari URL">
              <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleInsertImageByUrl)}>
                <FiImage size={14} /> URL
              </button>
            </TooltipWrap>
            <TooltipWrap label="Upload gambar">
              <button
                type="button"
                className={`${toolbarButtonClass} inline-flex items-center gap-1`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  imageInputRef.current?.click();
                }}
              >
                <FiUploadCloud size={14} /> Upload
              </button>
            </TooltipWrap>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                void handleUploadImage(file);
                e.currentTarget.value = "";
              }}
            />
            {allowPdf && (
              <>
                <TooltipWrap label="Upload PDF">
                  <button
                    type="button"
                    className={`${toolbarButtonClass} inline-flex items-center gap-1`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pdfInputRef.current?.click();
                    }}
                  >
                    <FiFileText size={14} /> PDF
                  </button>
                </TooltipWrap>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleUploadPdf(file);
                    e.currentTarget.value = "";
                  }}
                />
              </>
            )}
            {allowTables && (
              <div className="relative">
                <TooltipWrap label="Sisipkan tabel">
                  <button
                    type="button"
                    className={`${toolbarButtonClass} inline-flex items-center gap-1`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowTablePicker((prev) => !prev);
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <FiGrid size={14} /> Table
                  </button>
                </TooltipWrap>
                {showTablePicker && (
                  <div className="absolute right-0 top-9 z-20 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="grid grid-cols-8 gap-2">
                      {Array.from({ length: 64 }, (_, idx) => {
                        const r = Math.floor(idx / 8) + 1;
                        const c = (idx % 8) + 1;
                        const active = r <= tableHover.rows && c <= tableHover.cols;
                        return (
                          <button
                            key={`${r}-${c}`}
                            type="button"
                            className={`h-7 w-7 rounded-[4px] border ${active ? "border-slate-700 bg-slate-700" : "border-slate-300 bg-white"}`}
                            onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertTableAtSelection(r, c);
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-xs text-slate-600">{tableHover.rows || 0} x {tableHover.cols || 0}</p>
                  </div>
                )}
              </div>
            )}
            {allowTables && (
              <>
                <TooltipWrap label="Tambah baris tabel">
                  <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleAddTableRow)}><FiPlusSquare size={14} /> Baris</button>
                </TooltipWrap>
                <TooltipWrap label="Hapus baris tabel">
                  <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleDeleteTableRow)}><FiMinusSquare size={14} /> Baris</button>
                </TooltipWrap>
                <TooltipWrap label="Tambah kolom tabel">
                  <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleAddTableColumn)}><FiPlusSquare size={14} /> Kolom</button>
                </TooltipWrap>
                <TooltipWrap label="Hapus kolom tabel">
                  <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1`} onMouseDown={runToolbarAction(handleDeleteTableColumn)}><FiMinusSquare size={14} /> Kolom</button>
                </TooltipWrap>
                <TooltipWrap label="Hapus tabel aktif">
                  <button type="button" className={`${toolbarButtonClass} inline-flex items-center gap-1 text-red-700`} onMouseDown={runToolbarAction(handleDeleteCurrentTable)}><FiTrash2 size={14} /> Tabel</button>
                </TooltipWrap>
              </>
            )}
            <TooltipWrap label="Media rata kiri">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => alignSelectedMedia("left"))}><FiAlignLeft size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Media rata tengah">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => alignSelectedMedia("center"))}><FiAlignCenter size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Media rata kanan">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(() => alignSelectedMedia("right"))}><FiAlignRight size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Hapus media terpilih">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(removeSelectedMediaBlock)}><FiTrash2 size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Undo">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(handleUndo)}><FiRotateCcw size={14} /></button>
            </TooltipWrap>
            <TooltipWrap label="Redo">
              <button type="button" className={toolbarButtonClass} onMouseDown={runToolbarAction(handleRedo)}><FiRotateCw size={14} /></button>
            </TooltipWrap>
          </div>

          <div
            ref={editorRef}
            contentEditable
            dir="ltr"
            suppressContentEditableWarning
            onMouseUp={updateSelectionRange}
            onKeyUp={updateSelectionRange}
            onFocus={updateSelectionRange}
            onKeyDown={(e) => {
              if ((e.key === "Delete" || e.key === "Backspace") && selectedMediaRef.current) {
                e.preventDefault();
                removeSelectedMediaBlock();
                return;
              }

              if (
                selectedMediaRef.current &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey &&
                (e.key.length === 1 || e.key === "Enter")
              ) {
                moveCaretAfterMedia(selectedMediaRef.current);
              }
            }}
            onDragStart={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-media-block='1']")) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-media-block='1']")) {
                e.preventDefault();
              }
            }}
            onMouseMove={(e) => {
              const target = e.target as HTMLElement;
              const media = target.closest("[data-media-block='1']") as HTMLDivElement | null;
              setHoveredMedia(media);
            }}
            onMouseLeave={() => {
              if (hoveredMediaRef.current && hoveredMediaRef.current !== selectedMediaRef.current) {
                showMediaDeleteButton(hoveredMediaRef.current, false);
              }
              hoveredMediaRef.current = null;
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              const editor = editorRef.current;
              if (!editor) return;
              const deleteBtn = target.closest("[data-media-delete='1']") as HTMLElement | null;
              if (deleteBtn) {
                const media = deleteBtn.closest("[data-media-block='1']") as HTMLDivElement | null;
                if (media && editor.contains(media)) {
                  setSelectedMedia(media);
                  removeSelectedMediaBlock();
                }
                return;
              }
              const media = target.closest("[data-media-block='1']") as HTMLDivElement | null;
              if (media && editor.contains(media)) {
                setSelectedMedia(media);
                return;
              }
              setSelectedMedia(null);
            }}
            onInput={(e) => {
              const node = e.currentTarget as HTMLDivElement;
              normalizeEditorNodeDirection(node);
              ensureMediaBlocksEditableBehavior(node);
              updateSelectionRange();
              emitHtmlChange(node.innerHTML);
              pushHistorySnapshot(node.innerHTML);
              redoRef.current = [];
            }}
            className={`sage-tiptap-content ${editorClassName} overflow-y-auto p-4 outline-none leading-relaxed text-left`}
            style={{ direction: "ltr", unicodeBidi: "normal", writingMode: "horizontal-tb", textAlign: "left" }}
          />
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
        {uploading && <div className="text-xs text-slate-500">Uploading media...</div>}
      </div>

      {showPreview && (
        <div className="hidden lg:block">
          <div className="sticky top-0 max-h-[64vh] overflow-y-auto rounded-lg border bg-white p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
            <div className="prose prose-slate max-w-none text-sm" dangerouslySetInnerHTML={{ __html: cleanEditorOutput(editorHtml) }} />
          </div>
        </div>
      )}
    </div>
  );
}
