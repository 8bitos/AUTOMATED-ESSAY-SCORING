export const reorderQuestionIdsByDirection = (
  ids: string[],
  questionId: string,
  direction: "up" | "down"
): string[] => {
  const currentIndex = ids.indexOf(questionId);
  if (currentIndex < 0) return ids;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return ids;
  const reordered = [...ids];
  const [picked] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, picked);
  return reordered;
};

export const reorderQuestionIdsByDrop = (
  ids: string[],
  sourceQuestionId: string,
  targetQuestionId: string
): string[] => {
  if (sourceQuestionId === targetQuestionId) return ids;
  const sourceIndex = ids.indexOf(sourceQuestionId);
  const targetIndex = ids.indexOf(targetQuestionId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;
  const reordered = [...ids];
  const [picked] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, picked);
  return reordered;
};
