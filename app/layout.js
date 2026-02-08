export const metadata = {
  title: 'VFB Chat Client',
  description: 'Guardrailed chat for Virtual Fly Brain neuroanatomy queries',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, padding: 20 }}>
        {children}
      </body>
    </html>
  )
}