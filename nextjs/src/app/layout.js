import { Inter } from 'next/font/google'
// import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Fišingo Atpažinimo Testas',
  description: 'Fišingo Atpažinimo Testas',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }} className={inter.className}>
        {children}
      </body>
    </html>
  )
}
