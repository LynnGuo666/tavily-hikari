import BrandLockup from '../components/BrandLockup'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { createContext, type PropsWithChildren, type ReactNode, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'

import type { AdminAnalysisView, AdminModuleId } from './routes'

export type AdminNavTarget =
  | AdminModuleId
  | 'analysis-usage'
  | 'analysis-rankings'
  | 'analysis-pressure'
  | 'system-settings-status'
  | 'system-settings-admin'
  | 'system-settings-ha'

export interface AdminNavSubItem {
  target: AdminNavTarget
  label: string
}

export interface AdminNavItem {
  target: AdminNavTarget
  label: string
  icon: ReactNode
  children?: AdminNavSubItem[]
}

interface AdminShellProps extends PropsWithChildren {
  activeItem: AdminNavTarget
  navItems: AdminNavItem[]
  skipToContentLabel: string
  onSelectItem: (target: AdminNavTarget) => void
}

const AdminSidebarUtilityContext = createContext<HTMLDivElement | null>(null)

interface AdminSidebarNavigationProps {
  activeItem: AdminNavTarget
  navItems: AdminNavItem[]
  onSelectItem: (target: AdminNavTarget) => void
  onUtilityHostChange: (host: HTMLDivElement | null) => void
}

function AdminSidebarNavigation({
  activeItem,
  navItems,
  onSelectItem,
  onUtilityHostChange,
}: AdminSidebarNavigationProps): React.JSX.Element {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleSelectItem = useCallback(
    (target: AdminNavTarget) => {
      if (isMobile) setOpenMobile(false)
      onSelectItem(target)
    },
    [isMobile, onSelectItem, setOpenMobile],
  )

  return (
    <Sidebar>
      <SidebarHeader>
        <BrandLockup title="Tavily Hikari" variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav id="admin-sidebar-nav" aria-label="Admin navigation">
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = item.target === activeItem
                  const childActive = item.children?.some((child) => child.target === activeItem) ?? false
                  return (
                    <SidebarMenuItem key={item.target}>
                      <SidebarMenuButton
                        isActive={active}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'admin-nav-item',
                          active && 'admin-nav-item-active',
                          childActive && 'admin-nav-item-parent-active',
                        )}
                        onClick={() => handleSelectItem(item.target)}
                      >
                        <span className="admin-nav-item-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.children && item.children.length > 0 && (
                        <SidebarMenuSub aria-label={item.label}>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.target}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={child.target === activeItem}
                                className={cn(
                                  'admin-nav-subitem',
                                  child.target === activeItem && 'admin-nav-subitem-active',
                                )}
                              >
                                <button
                                  type="button"
                                  aria-current={child.target === activeItem ? 'page' : undefined}
                                  onClick={() => handleSelectItem(child.target)}
                                >
                                  <span>{child.label}</span>
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div ref={onUtilityHostChange} className="admin-sidebar-utility" />
      </SidebarFooter>
    </Sidebar>
  )
}

export default function AdminShell({
  activeItem,
  navItems,
  skipToContentLabel,
  onSelectItem,
  children,
}: AdminShellProps): React.JSX.Element {
  const [sidebarUtilityHost, setSidebarUtilityHost] = useState<HTMLDivElement | null>(null)

  return (
    <AdminSidebarUtilityContext.Provider value={sidebarUtilityHost}>
      <SidebarProvider>
        <AdminSidebarNavigation
          activeItem={activeItem}
          navItems={navItems}
          onSelectItem={onSelectItem}
          onUtilityHostChange={setSidebarUtilityHost}
        />
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
            <a
              href="#admin-main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
            >
              {skipToContentLabel}
            </a>
          </header>
          <div id="admin-main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col p-4 lg:p-6 admin-main-content">
            <div className="admin-shell-content flex min-w-0 flex-1 flex-col gap-6">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AdminSidebarUtilityContext.Provider>
  )
}

export function AdminShellSidebarUtility({ children }: PropsWithChildren): React.JSX.Element | null {
  const host = useContext(AdminSidebarUtilityContext)

  if (!host) {
    return null
  }

  return createPortal(children, host)
}
