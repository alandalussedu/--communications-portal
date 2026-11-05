/**
 * The bridge to the iOS app (Capacitor). On the website every function here is
 * a no-op or falls back to the browser, so pages can call them freely.
 *
 *  - Face ID: after a password sign-in the member may keep the phone and
 *    password in the iPhone Keychain, readable only after Face ID / Touch ID.
 *  - Push: the device token is saved in Supabase (`push_tokens`, own rows only)
 *    and the `send-push` function sends through Apple (APNs).
 *  - Share: the iOS share sheet for library links.
 */
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import { PushNotifications } from "@capacitor/push-notifications"
import { Share } from "@capacitor/share"
import { SplashScreen } from "@capacitor/splash-screen"
import { StatusBar, Style } from "@capacitor/status-bar"
import { AccessControl, BiometryType, NativeBiometric } from "@capgo/capacitor-native-biometric"
import { onBeforeSignOut, supabase, signIn } from "./backend"

export const isNative = () => Capacitor.isNativePlatform()
export const nativePlatform = () => Capacitor.getPlatform() // "ios" | "android" | "web"

/** Keychain entry name. Kept stable: changing it forgets every saved Face ID sign-in. */
const KEYCHAIN = "sa.edu.andalus.portal.login"

/* ------------------------------------------------------------ app start */
let started = false
export function startNative(go: (hash: string) => void) {
  if (started || !isNative()) return
  started = true
  onBeforeSignOut(disablePush)
  // white status-bar text over the navy band
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  SplashScreen.hide().catch(() => {})
  // a tapped notification may carry a page to open (e.g. "remedial-faiha")
  PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const route = (a.notification.data as { route?: unknown } | undefined)?.route
    if (typeof route === "string" && /^[a-z0-9-]+$/.test(route)) go(route)
  }).catch(() => {})
  // coming back to the app: refresh the session so data reloads with a valid token
  App.addListener("resume", () => void supabase()?.auth.getSession()).catch(() => {})
}

/* ------------------------------------------------------------ Face ID / Touch ID */
export type Biometry = { available: boolean; label: string }

export async function biometry(): Promise<Biometry> {
  if (!isNative()) return { available: false, label: "" }
  try {
    const r = await NativeBiometric.isAvailable()
    const label = r.biometryType === BiometryType.TOUCH_ID ? "بصمة الإصبع" : "بصمة الوجه"
    return { available: r.isAvailable, label }
  } catch {
    return { available: false, label: "" }
  }
}

export async function biometricSaved(): Promise<boolean> {
  if (!isNative()) return false
  try {
    return (await NativeBiometric.isCredentialsSaved({ server: KEYCHAIN })).isSaved
  } catch {
    return false
  }
}

/** Keeps the sign-in in the Keychain, readable only after a biometric check on this device. */
export async function saveBiometricLogin(phone: string, password: string): Promise<boolean> {
  try {
    await NativeBiometric.deleteCredentials({ server: KEYCHAIN }).catch(() => {})
    await NativeBiometric.setCredentials({ username: phone, password, server: KEYCHAIN, accessControl: AccessControl.BIOMETRY_CURRENT_SET })
    return true
  } catch {
    return false
  }
}

/** Updates the saved password after a password change, if Face ID sign-in is on. */
export async function updateBiometricPassword(phone: string, password: string) {
  if (await biometricSaved()) await saveBiometricLogin(phone, password)
}

export async function forgetBiometricLogin() {
  await NativeBiometric.deleteCredentials({ server: KEYCHAIN }).catch(() => {})
}

/** Face ID, then the normal sign-in with the saved phone and password. Returns an error message or null. */
export async function biometricSignIn(): Promise<string | null> {
  try {
    const c = await NativeBiometric.getSecureCredentials({ server: KEYCHAIN, reason: "الدخول إلى بوابة التواصل المؤسسي" })
    const err = await signIn(c.username, c.password)
    // the password was changed elsewhere: the saved one no longer works
    if (err && /غير صحيحة/.test(err)) {
      await forgetBiometricLogin()
      return "تغيّرت كلمة المرور. ادخل بكلمة المرور الجديدة، ثم فعّل الدخول بالبصمة من جديد."
    }
    return err
  } catch (e) {
    const code = String((e as { code?: unknown })?.code ?? "")
    // the person cancelled the prompt: nothing to say
    if (/cancel/i.test(String((e as Error)?.message)) || code === "16" || code === "10") return ""
    if (code === "21") return "لم يُحفظ دخول بالبصمة على هذا الجهاز."
    return "تعذّر التحقق بالبصمة. ادخل بكلمة المرور."
  }
}

/* ------------------------------------------------------------ push notifications */
let pushUser: string | null = null
const TOKEN_KEY = "andalus.pushToken"
const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Asks once for permission, then saves this device's token for the signed-in member. */
export async function enablePush(userId: string): Promise<void> {
  if (!isNative() || pushUser === userId) return
  pushUser = userId
  try {
    let p = await PushNotifications.checkPermissions()
    if (p.receive === "prompt" || p.receive === "prompt-with-rationale") p = await PushNotifications.requestPermissions()
    if (p.receive !== "granted") return
    await PushNotifications.removeAllListeners().catch(() => {})
    await PushNotifications.addListener("registration", async ({ value }) => {
      const sb = supabase()
      if (!sb || !value) return
      try {
        localStorage.setItem(TOKEN_KEY, value)
      } catch {
        /* the token is still saved on the server */
      }
      await sb.from("push_tokens").upsert({ token: value, user_id: userId, platform: nativePlatform(), updated_at: new Date().toISOString() }, { onConflict: "token" })
    })
    await PushNotifications.register()
  } catch {
    pushUser = null
  }
}

/** On sign-out this device stops receiving the member's notifications. */
export async function disablePush(): Promise<void> {
  if (!isNative()) return
  pushUser = null
  try {
    const sb = supabase(), token = readToken()
    // only this device: the member may also use the app on an iPad
    if (sb && token) await sb.from("push_tokens").delete().eq("token", token)
    await PushNotifications.unregister()
  } catch {
    /* already signed out or offline: the server drops dead tokens on its next send */
  }
}

/* ------------------------------------------------------------ share */
/** The share sheet in the app, the browser's own share where it exists, else false. */
export async function shareLink(title: string, url: string): Promise<boolean> {
  try {
    if (isNative()) {
      await Share.share({ title, text: title, url, dialogTitle: "مشاركة" })
      return true
    }
    if (navigator.share) {
      await navigator.share({ title, url })
      return true
    }
  } catch {
    // cancelled by the person: not an error
    return true
  }
  return false
}

export const canShare = () => isNative() || typeof navigator.share === "function"
