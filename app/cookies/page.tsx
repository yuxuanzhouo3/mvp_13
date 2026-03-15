import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Cookie Policy</h1>
        <div className="prose max-w-none dark:prose-invert">
          <p>
            RentGuard uses cookies to improve your experience on our website.
          </p>
          <h2>What Are Cookies</h2>
          <p>
            Cookies are small text files that are stored on your computer or mobile device when you visit a website.
          </p>
          <h2>How We Use Cookies</h2>
          <p>
            We use cookies to remember your preferences, analyze our traffic, and personalize content.
          </p>
          <h2>Managing Cookies</h2>
          <p>
            You can control and manage cookies in your browser settings.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
