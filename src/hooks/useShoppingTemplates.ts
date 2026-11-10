import { message } from "../lib/messages";
import {
  makeShoppingTemplate,
  applyShoppingTemplate,
} from "../lib/shopping/templates";
import type { AppDataController } from "./useAppData";
import type { AppFeedback } from "./useAppFeedback";

export function useShoppingTemplates(
  store: AppDataController,
  feedback: AppFeedback,
) {
  const language = store.data.profile.language;
  function saveTemplate(name: string): boolean {
    const saved = store.mutateData((current) => ({
      ...current,
      shoppingTemplates: [
        ...(current.shoppingTemplates ?? []),
        makeShoppingTemplate(name, current),
      ],
    }));
    if (!saved) return false;
    feedback.setToast({ message: message(language, "ui.templateSaved") });
    return true;
  }
  function applyTemplate(id: string): boolean {
    if (!store.mutateData((current) => applyShoppingTemplate(current, id)))
      return false;
    feedback.setToast({
      message: message(language, "ui.templateAddedToTheList"),
    });
    return true;
  }
  function deleteTemplate(id: string): boolean {
    if (
      !store.mutateData((current) => ({
        ...current,
        shoppingTemplates: (current.shoppingTemplates ?? []).filter(
          (template) => template.id !== id,
        ),
      }))
    )
      return false;
    feedback.setToast({ message: message(language, "ui.templateDeleted") });
    return true;
  }
  return { saveTemplate, applyTemplate, deleteTemplate };
}
