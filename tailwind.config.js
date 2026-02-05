/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#e2e8f0",
        sand: "#f8fafc",
        luxe: "#111827",
        gold: "#d4af37",
        glass: "rgba(255, 255, 255, 0.7)"
      },
      boxShadow: {
        card: "0 10px 40px rgba(15, 23, 42, 0.15)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};