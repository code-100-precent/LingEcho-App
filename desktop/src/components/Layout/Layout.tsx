import { ReactNode } from 'react'
import Header from './Header.tsx'

interface LayoutProps {
    children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
    return (
        <div className="h-screen flex flex-col bg-background text-foreground">
            <Header
                logo={{
                    text: '声驭智核',
                    subtext: '',
                    image: 'https://cetide-1325039295.cos.ap-chengdu.myqcloud.com/code100/favicon.ico',
                    href: '/'
                }}
            />
            <div className="flex flex-1 min-h-0">
                <main className="flex-1 min-h-0 overflow-auto bg-background">
                    {children}
                </main>
            </div>
        </div>
    )
}

export default Layout
