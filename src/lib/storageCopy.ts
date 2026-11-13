export const storageCopy = {
  en: {
    usage: "Site storage",
    usageHint:
      "Approximate usage and quota for this site, including offline files.",
    mb: "MB",
    restore: "Restore data from before replacement",
    restoreHint:
      "Replace current data with the saved state from before the last replacement. Current data will be kept in the same recovery slot when possible.",
    restored: "Data from before replacement restored.",
    missing: "No pre-replacement copy is available.",
    failed: "Could not restore the pre-replacement copy.",
  },
  ru: {
    usage: "Хранилище сайта",
    usageHint: "Примерный объём и квота сайта, включая офлайн-файлы.",
    mb: "МБ",
    restore: "Восстановить данные до замены",
    restoreHint:
      "Заменить текущие данные сохранённым состоянием до последней замены. Текущие данные по возможности сохранятся в том же слоте отката.",
    restored: "Данные до замены восстановлены.",
    missing: "Копия данных до замены недоступна.",
    failed: "Не удалось восстановить данные до замены.",
  },
} as const;
