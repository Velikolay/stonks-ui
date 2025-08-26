# Stonks UI

A modern Next.js application built with TypeScript, shadcn/ui components, and Server-Side Rendering (SSR). This project demonstrates best practices for building scalable React applications with Next.js 15.

## 🚀 Features

- **Next.js 15** - Latest version with App Router and Server Components
- **TypeScript** - Full type safety and IntelliSense support
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Server-Side Rendering** - SEO-friendly and fast initial page loads
- **ESLint & Prettier** - Code quality and formatting
- **Dark Mode Support** - Built-in theme switching
- **Responsive Design** - Mobile-first approach

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Linting**: ESLint with TypeScript and React rules
- **Formatting**: Prettier
- **Package Manager**: npm

## 📦 Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd stonks-ui
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎯 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Turbopack
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

## 🏗️ Project Structure

```
stonks-ui/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── components/          # React components
│   │   └── ui/             # shadcn/ui components
│   └── lib/                # Utility functions
├── public/                 # Static assets
├── components.json         # shadcn/ui configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint configuration
├── .prettierrc            # Prettier configuration
└── package.json           # Dependencies and scripts
```

## 🎨 UI Components

This project uses shadcn/ui components, which are built on top of Radix UI primitives and styled with Tailwind CSS. Available components include:

- Button
- Card
- Input
- Label

To add more components, use:

```bash
npx shadcn@latest add <component-name>
```

## 🔧 Configuration

### ESLint

Enhanced ESLint configuration with:

- TypeScript-specific rules
- React and React Hooks rules
- Prettier integration
- Custom rules for code quality

### Prettier

Configured with sensible defaults:

- 2-space indentation
- 80 character line width
- Double quotes
- Trailing commas

### TypeScript

Strict TypeScript configuration with:

- No implicit any
- Strict null checks
- No unused variables
- Path mapping for clean imports

## 🌙 Dark Mode

The application supports dark mode out of the box. The theme automatically adapts based on the user's system preferences.

## 📱 Responsive Design

Built with a mobile-first approach using Tailwind CSS responsive utilities. The layout adapts seamlessly across all device sizes.

## 🚀 Deployment

This project can be deployed to any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Railway**
- **AWS Amplify**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting:
   ```bash
   npm run lint:fix
   npm run format
   ```
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Links

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
