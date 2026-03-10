import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose max-w-none dark:prose-invert">
          <p>Last updated: October 2023</p>
          <p>
            Your privacy is important to us. This Privacy Policy explains how RentGuard collects, uses, and discloses your personal information.
          </p>
          <h2>Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, list a property, or contact support.
          </p>
          <h2>How We Use Your Information</h2>
          <p>
            We use your information to provide and improve our services, process payments, and communicate with you.
          </p>
          <h2>Sharing of Information</h2>
          <p>
            We do not sell your personal information. We may share your information with third-party service providers who assist us in our operations.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
