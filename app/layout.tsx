import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'THE CHALLENGE',description:'Erin and Kazzy’s daily accountability challenge.',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',apple:'/apple-touch-icon.png'},appleWebApp:{capable:true,title:'THE CHALLENGE',statusBarStyle:'default'}};
export const viewport:Viewport={themeColor:'#f6f8fb',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
