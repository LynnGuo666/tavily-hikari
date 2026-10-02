import RequestLogDetailSection from '@/components/RequestLogDetailSection'
import type { RequestLog } from '../api'
import type React from 'react'

type Language = 'en' | 'zh'

export default function RequestIpDiagnostics({
  log,
  language,
}: {
  log: RequestLog
  language: Language
}): React.JSX.Element | null {
  const ipHeaders = (log.ip_headers ?? []).filter(
    (item) => item.name.trim().length > 0 || item.value.trim().length > 0,
  )
  if (!log.remote_addr && !log.client_ip && !log.client_ip_source && ipHeaders.length === 0) {
    return null
  }
  return (
    <div className="log-details-headers grid min-w-0 gap-3 lg:grid-cols-2">
      <RequestLogDetailSection title={language === 'zh' ? 'IP 诊断' : 'IP diagnostics'}>
        <ul>
          <li>
            remoteAddr: <code>{log.remote_addr ?? '-'}</code>
          </li>
          <li>
            clientIp: <code>{log.client_ip ?? '-'}</code>
          </li>
          <li>
            source: <code>{log.client_ip_source ?? '-'}</code>
          </li>
          <li>{language === 'zh' ? '可信代理' : 'trusted proxy'}: {log.client_ip_trusted ? 'yes' : 'no'}</li>
        </ul>
      </RequestLogDetailSection>
      {ipHeaders.length > 0 ? (
        <RequestLogDetailSection title={language === 'zh' ? 'IP 头值快照' : 'IP header values'}>
          <ul>
            {ipHeaders.map((header, index) => (
              <li key={`ip-header-${index}-${header.name}-${header.value}`}>
                <code>{header.name}</code>: <code>{header.value}</code>
              </li>
            ))}
          </ul>
        </RequestLogDetailSection>
      ) : null}
    </div>
  )
}
