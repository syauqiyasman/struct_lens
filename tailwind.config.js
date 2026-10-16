/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        cad: {
          bg: "#101216",
          panel: "#171a20",
          panel2: "#1e222b",
          border: "#2a2f3a",
          accent: "#e8b33c",
          grid: "#232833",
        },
      },
    },
  },
  plugins: [],
};
