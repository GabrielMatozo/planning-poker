const NAME_KEY = "pp:name";

export function loadStoredName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Armazenamento bloqueado no navegador: o nome vale só para esta visita.
  }
}
