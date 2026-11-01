import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./extra.css"
import App from "./App"
import { FONT_CSS } from "./assets/fonts"

// The font ships inside the page so the platform and its PDF export render the
// same Tajawal glyphs without reaching a font server.
const fontStyle = document.createElement("style")
fontStyle.id = "embedded-fonts"
fontStyle.textContent = FONT_CSS
document.head.appendChild(fontStyle)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
