/** @type {import('tailwindcss').Config} */
const c = (v) => `hsl(var(--${v}) / <alpha-value>)`
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "Tahoma", '"Segoe UI"', "system-ui", "sans-serif"],
        display: ["Tajawal", "Tahoma", '"Segoe UI"', "sans-serif"],
      },
      colors: {
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        background: c("background"),
        foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        secondary: { DEFAULT: c("secondary"), foreground: c("secondary-foreground") },
        destructive: { DEFAULT: c("bad"), foreground: c("primary-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        popover: { DEFAULT: c("popover"), foreground: c("foreground") },
        card: { DEFAULT: c("card"), foreground: c("foreground") },
        band: { DEFAULT: c("band"), foreground: c("band-foreground"), soft: c("band-soft") },
        gold: { DEFAULT: c("gold"), ink: c("gold-ink"), soft: c("gold-soft") },
        sky: { DEFAULT: c("sky"), ink: c("sky-ink"), soft: c("sky-soft") },
        ok: { DEFAULT: c("ok"), soft: c("ok-soft") },
        warn: { DEFAULT: c("warn"), soft: c("warn-soft") },
        bad: { DEFAULT: c("bad"), soft: c("bad-soft") },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
