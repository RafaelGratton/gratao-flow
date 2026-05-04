import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F3EC",
        ink: "#1F2933",
        muted: "#667085",
        line: "#E8DED0",
        accent: {
          DEFAULT: "#C9972B",
          dark: "#8A6518",
          soft: "#F5E8C6"
        },
        nav: "#111111",
        success: "#2F7D58",
        warning: "#B7791F",
        danger: "#B42318"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(17, 18, 20, 0.08)",
        insetline: "inset 0 0 0 1px rgba(232, 222, 208, 0.92)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
