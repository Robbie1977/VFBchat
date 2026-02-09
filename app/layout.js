export const metadata = {
  title: 'Virtual Fly Brain',
  description: 'Guardrailed chat for Virtual Fly Brain neuroanatomy queries',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, padding: 0, background: 'black' }}>
        {children}
      </body>
    </html>
  )
}