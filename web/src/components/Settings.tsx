import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

/* ═══════════════════════════════════════════════════
   Settings — 设置页:API key 配置 + Vault 切换/新建
   ADR-0003 D4(多 Vault)/ D5(ingest 中禁切)/ D7(切库闭环)/ D3.1(config.json 真相源)
   ═══════════════════════════════════════════════════ */

interface VaultEntry {
  path: string
  name?: string
}

interface ConfigStatus {
  provider: string
  model: string
  hasApiKey: boolean
}

export default function Settings() {
  const [vaults, setVaults] = useState<VaultEntry[]>([])
  const [currentVault, setCurrentVault] = useState('')
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [ingestActive, setIngestActive] = useState(false)

  const [apiKeyInput, setApiKeyInput] = useState('')
  const [newVaultName, setNewVaultName] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [vaultsRes, statusRes, activeRes] = await Promise.all([
        fetch('/api/vaults'),
        fetch('/api/config/status'),
        fetch('/api/ingest/active'),
      ])
      const vdata = (await vaultsRes.json()) as { vaults: VaultEntry[]; currentVault: string }
      setVaults(vdata.vaults ?? [])
      setCurrentVault(vdata.currentVault ?? '')
      setConfigStatus((await statusRes.json()) as ConfigStatus)
      setIngestActive(((await activeRes.json()) as { active: boolean }).active ?? false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 监听 ingest 状态变化(useChat dispatch 的 ingest-state 事件)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active: boolean }
      setIngestActive(detail.active)
    }
    window.addEventListener('ingest-state', handler)
    return () => window.removeEventListener('ingest-state', handler)
  }, [])

  const saveApiKey = async () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    setSavingKey(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/config/apikey', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setNotice('API key 已保存并生效')
        setApiKeyInput('')
        void load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingKey(false)
    }
  }

  const switchVault = async (vaultPath: string) => {
    if (ingestActive || vaultPath === currentVault) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/vault/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: vaultPath }),
      })
      if (res.status === 409) {
        setError('有上传正在处理,请等待完成后再切换 Vault')
        setIngestActive(true)
      } else if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setNotice('已切换知识库,正在重连…')
        // vault_changed → useChat 清空消息重连 + useData 重拉 pages
        // 切库后回到首页(旧文章 stem 在新库可能不存在)
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const createVault = async () => {
    const trimmed = newVaultName.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setNotice(`已新建知识库"${trimmed}",点击列表中的"切换"以打开`)
        setNewVaultName('')
        void load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <div className="settings-inner">
        <div className="settings-header">
          <h1 className="settings-title">设置</h1>
          <Link to="/" className="settings-back">
            返回首页
          </Link>
        </div>

        {error && <div className="settings-error">{error}</div>}
        {notice && <div className="settings-notice">{notice}</div>}

        {/* ── API key ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Ark API Key</h2>
          <p className="settings-hint">
            {configStatus?.hasApiKey
              ? '当前已配置 API key(出于安全不回显明文,可直接覆盖更新)。'
              : '尚未配置 API key,agent 调用将不可用。请填入后保存。'}
          </p>
          {configStatus && (
            <p className="settings-meta">
              provider <code>{configStatus.provider}</code> · model{' '}
              <code>{configStatus.model}</code>
            </p>
          )}
          <div className="settings-row">
            <input
              className="settings-input"
              type="password"
              placeholder="填入 Ark API key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="settings-btn primary"
              onClick={() => void saveApiKey()}
              disabled={savingKey || !apiKeyInput.trim()}
            >
              {savingKey ? '保存中…' : '保存'}
            </button>
          </div>
        </section>

        {/* ── Vault 列表 + 切换 ── */}
        <section className="settings-section">
          <h2 className="settings-section-title">知识库(Vault)</h2>
          {ingestActive && (
            <p className="settings-warning">有上传正在处理,切换已禁用,请等待完成。</p>
          )}
          <ul className="vault-list">
            {vaults.map((v) => {
              const isCurrent = v.path === currentVault
              return (
                <li key={v.path} className={`vault-item ${isCurrent ? 'current' : ''}`}>
                  <div className="vault-info">
                    <span className="vault-name">{v.name || v.path}</span>
                    <code className="vault-path">{v.path}</code>
                    {isCurrent && <span className="vault-tag">当前</span>}
                  </div>
                  <button
                    type="button"
                    className="settings-btn"
                    onClick={() => void switchVault(v.path)}
                    disabled={isCurrent || ingestActive || busy}
                  >
                    切换
                  </button>
                </li>
              )
            })}
            {vaults.length === 0 && <li className="vault-empty">暂无已登记的知识库</li>}
          </ul>

          {/* ── 新建 Vault ── */}
          <div className="settings-row new-vault">
            <input
              className="settings-input"
              type="text"
              placeholder="新知识库名称(如:工作)"
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
            />
            <button
              type="button"
              className="settings-btn"
              onClick={() => void createVault()}
              disabled={busy || !newVaultName.trim()}
            >
              新建
            </button>
          </div>
          <p className="settings-hint">
            新建的知识库从样板复制结构,不会自动切换;点击列表"切换"以打开。
          </p>
        </section>
      </div>
    </div>
  )
}
