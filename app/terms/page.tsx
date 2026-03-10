import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
        <div className="prose max-w-none dark:prose-invert">
          <p>Last updated: October 2023</p>
          <p>
            Please read these Terms of Service carefully before using RentGuard.
          </p>
          <h2>Acceptance of Terms</h2>
          <p>
            By accessing or using our services, you agree to be bound by these Terms.
          </p>
          <h2>User Accounts</h2>
          <p>
            You are responsible for safeguarding your account password and for any activities or actions under your account.
          </p>
          <h2>Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
