import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'September Challenge',description:'Erin and Kazzy’s daily accountability challenge.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
