/* Toast léger global, sans dépendance : `toast()` émet un évènement window
   capté par <Toaster /> (monté une fois dans le layout racine). */

export type ToastTone = "default" | "success" | "error";
export type ToastDetail = { message: string; tone: ToastTone };

export function toast(message: string, tone: ToastTone = "default"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>("gedify-toast", { detail: { message, tone } }));
}
