/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#D48C88", // Rose Quartz Peach
          dark: "#3A1E1C",    // Dark Clay Espresso
          light: "#FDF6F5",   // Creamy Serum White
        },
        sidebar: {
          DEFAULT: "#3A1E1C", // Dark Clay Espresso for Sidebar background
          soft: "#D48C88",    // Rose Quartz Peach for Sidebar text labels
        },
        ink: {
          DEFAULT: "#3A1E1C",
          soft: "#705654",
          faint: "#A58C8A",
        },
        border: {
          DEFAULT: "#EAD5D3",
          strong: "#D48C88",
        },
        bg: "#FDF6F5", // Creamy Serum White background
        surface: "#FFFFFF",
        success: {
          DEFAULT: "#2E613D", // Muted Green Tea
          bg: "#EAF2EB",
        },
        warning: {
          DEFAULT: "#9E6715", // Honey Propolis
          bg: "#FDF6EB",
        },
        danger: {
          DEFAULT: "#A3362F", // Rose Hip Extract
          bg: "#FDF2F1",
        },
      },
      fontFamily: {
        heading: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        full: "20px",
      },
    },
  },
  plugins: [],
}
