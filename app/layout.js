import './globals.css'

export const metadata = {
  title: 'Student Portal API',
  description: 'Next.js and Node.js portal API with MongoDB data and Firebase image storage.',
}

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>
}
