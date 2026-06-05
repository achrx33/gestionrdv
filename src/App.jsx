import { useMemo, useState } from 'react'
import database from './data/database.json'
import './App.css'

const storageKey = 'gestion-rdv-json-db'
const sessionKey = 'gestion-rdv-session'
const weekDays = ['monday', 'Tuesday', 'wednesday', 'Thursday', 'friday', 'Saturday', 'Sunday']

function loadDatabase() {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return database

  const parsed = JSON.parse(saved)
  const merged = {
    ...database,
    ...parsed,
    patients: parsed.patients || database.patients,
    organismes: parsed.organismes || database.organismes,
    services: parsed.services || database.services,
    agendas: parsed.agendas || database.agendas,
    rdvs: parsed.rdvs || database.rdvs,
    users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : database.users,
  }

  localStorage.setItem(storageKey, JSON.stringify(merged, null, 2))
  return merged
}

function saveDatabase(data) {
  localStorage.setItem(storageKey, JSON.stringify(data, null, 2))
  return data
}

function nextCode(prefix, rows, field) {
  const max = rows.reduce((highest, row) => {
    const number = Number(String(row[field] || '').replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(highest, number) : highest
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function App() {
  const [db, setDb] = useState(loadDatabase)
  const [page, setPage] = useState('home')
  const [message, setMessage] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(sessionKey)
    return saved ? JSON.parse(saved) : null
  })

  function commit(updater, successMessage) {
    setDb((current) => saveDatabase(updater(current)))
    setMessage(successMessage)
  }

  function login(email, password) {
    const cleanLogin = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    const users = Array.isArray(db.users) && db.users.length > 0 ? db.users : database.users
    const user = users.find((item) => {
      const sameEmail = item.email.toLowerCase() === cleanLogin
      const sameName = item.nom.toLowerCase() === cleanLogin
      return (sameEmail || sameName) && item.password === cleanPassword
    })
    if (!user) {
      setMessage('Email ou mot de passe incorrect.')
      return
    }

    if (!Array.isArray(db.users) || db.users.length === 0) {
      setDb((current) => saveDatabase({ ...current, users: database.users }))
    }

    const nextSession = { id: user.id, nom: user.nom, email: user.email }
    localStorage.setItem(sessionKey, JSON.stringify(nextSession))
    setSession(nextSession)
    setMessage('')
    setPage('home')
  }

  function register(user) {
    const emailExists = db.users.some((item) => item.email.toLowerCase() === user.email.toLowerCase())
    if (emailExists) {
      setMessage('Cet email existe deja.')
      return
    }

    const nextUser = {
      id: nextCode('USR', db.users, 'id'),
      nom: user.nom,
      email: user.email,
      password: user.password,
    }

    commit((current) => ({ ...current, users: [...current.users, nextUser] }), 'Compte cree. Vous pouvez vous connecter.')
    setAuthMode('login')
  }

  function logout() {
    localStorage.removeItem(sessionKey)
    setSession(null)
    setPage('home')
    setMessage('')
  }

  const pages = {
    home: <Home db={db} />,
    demandes: <Demandes db={db} />,
    addRdv: <AddRdv db={db} commit={commit} />,
    confirm: <ConfirmRdv db={db} commit={commit} />,
    patients: <Patients db={db} commit={commit} />,
    agenda: <Agenda db={db} commit={commit} />,
    organismes: <Organismes db={db} commit={commit} />,
  }

  const menu = [
    ['home', 'Acceuil', 'HM'],
    ['demandes', 'Lister Les Demandes', 'SR'],
    ['addRdv', 'Donner Un RDV', 'RD'],
    ['confirm', 'Confirmer Les RDV', 'OK'],
    ['patients', 'Gestion Patient', 'PT'],
    ['agenda', 'Agenda Consultation', 'AG'],
    ['organismes', 'Ajouter Organisme', 'OR'],
  ]

  if (!session) {
    return (
      <AuthScreen
        mode={authMode}
        message={message}
        onLogin={login}
        onRegister={register}
        onSwitchMode={() => {
          setMessage('')
          setAuthMode((current) => (current === 'login' ? 'register' : 'login'))
        }}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">GestionRdv</div>
        <div className="topbar-user">
          <div className="admin-badge">{session.nom}</div>
          <span>connecter</span>
          <button className="logout" onClick={logout} type="button">Deconnecter</button>
        </div>
      </header>

      <aside className="sidebar">
        <span className="nav-divider">Menu</span>
        <nav className="nav-list">
          {menu.map(([key, label, icon]) => (
            <button
              className={page === key ? 'nav-item active' : 'nav-item'}
              key={key}
              onClick={() => setPage(key)}
              type="button"
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        {message && <p className="notice">{message}</p>}
        {pages[page]}
      </section>
    </main>
  )
}

function AuthScreen({ mode, message, onLogin, onRegister, onSwitchMode }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const isRegister = mode === 'register'

  function submit(event) {
    event.preventDefault()
    if (isRegister) {
      if (form.password !== form.confirmPassword) return
      onRegister(form)
      return
    }
    onLogin(form.email, form.password)
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">GR</span>
          <div>
            <strong>GestionRdv</strong>
            <span>Administration des rendez-vous</span>
          </div>
        </div>

        <h1>{isRegister ? 'Inscription' : 'Connexion'}</h1>
        {message && <p className="auth-message">{message}</p>}
        {isRegister && form.password && form.confirmPassword && form.password !== form.confirmPassword && (
          <p className="auth-error">Les mots de passe ne sont pas identiques.</p>
        )}

        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <Field label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
          )}
          <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="Mot de passe" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          {isRegister && (
            <Field label="Confirmer le mot de passe" type="password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
          )}

          <button className="primary-button" disabled={isRegister && form.password !== form.confirmPassword} type="submit">
            {isRegister ? 'Creer le compte' : 'Se connecter'}
          </button>
        </form>

        <button className="link-button" onClick={onSwitchMode} type="button">
          {isRegister ? 'J ai deja un compte' : 'Creer un compte'}
        </button>
        <p className="auth-hint">Compte test: admin@gestionrdv.local / admin123</p>
      </section>
    </main>
  )
}

function PageHeader({ title, parent = 'Accueil' }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="breadcrumb">
        <span>{parent}</span>
        <span>{title}</span>
      </div>
    </div>
  )
}

function Home({ db }) {
  const confirmed = db.rdvs.filter((rdv) => rdv.confirmer).length
  const cards = [
    ['Patients', db.patients.length],
    ['Demandes RDV', db.rdvs.length],
    ['RDV confirmes', confirmed],
    ['Agendas', db.agendas.length],
  ]

  return (
    <>
      <PageHeader title="Acceuil" />
      <section className="stats-grid">
        {cards.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
    </>
  )
}

function Demandes({ db }) {
  const [type, setType] = useState('ip')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const rows = useMemo(() => {
    return db.rdvs.filter((rdv) => {
      if (type === 'ip') return rdv.ip.toLowerCase().includes(query.toLowerCase())
      if (type === 'service') return !query || rdv.specialite === query
      return (!dateFrom || rdv.dateRDV >= dateFrom) && (!dateTo || rdv.dateRDV <= dateTo)
    })
  }, [db.rdvs, type, query, dateFrom, dateTo])

  return (
    <>
      <PageHeader title="Demande list" />
      <section className="panel">
        <div className="filters">
          <label>
            Type de rechercher
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="ip">Search by IP</option>
              <option value="date">Search by date</option>
              <option value="service">Service</option>
            </select>
          </label>

          {type === 'date' ? (
            <>
              <label>
                de:
                <input value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" />
              </label>
              <label>
                A:
                <input value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" />
              </label>
            </>
          ) : (
            <label>
              {type === 'ip' ? 'IP' : 'Service'}
              {type === 'service' ? (
                <select value={query} onChange={(event) => setQuery(event.target.value)}>
                  <option value="">display All</option>
                  {db.services.map((service) => (
                    <option key={service.specialite}>{service.specialite}</option>
                  ))}
                </select>
              ) : (
                <input value={query} onChange={(event) => setQuery(event.target.value)} />
              )}
            </label>
          )}
        </div>
        <RdvTable rows={rows} actionLabel="Detail" />
      </section>
    </>
  )
}

function AddRdv({ db, commit }) {
  const [form, setForm] = useState({
    idRDV: nextCode('RDV', db.rdvs, 'idRDV'),
    ip: db.patients[0]?.ip || '',
    specialite: db.services[0]?.specialite || '',
    code: db.agendas[0]?.code || '',
    ficheref: '',
    dateRDV: '',
    confirmer: false,
  })

  function submit(event) {
    event.preventDefault()
    commit((current) => ({ ...current, rdvs: [...current.rdvs, form] }), 'RDV ajoute.')
    setForm((current) => ({
      ...current,
      idRDV: nextCode('RDV', [...db.rdvs, form], 'idRDV'),
      ficheref: '',
      dateRDV: '',
      confirmer: false,
    }))
  }

  return (
    <>
      <PageHeader title="ADD APPOINTMENT" parent="Parametrage" />
      <form className="panel form-grid" onSubmit={submit}>
        <Field label="idRDV" readOnly value={form.idRDV} />
        <Select label="ip" value={form.ip} onChange={(value) => setForm({ ...form, ip: value })} options={db.patients.map((patient) => patient.ip)} />
        <Select label="Specialite" value={form.specialite} onChange={(value) => setForm({ ...form, specialite: value })} options={db.services.map((service) => service.specialite)} />
        <Select label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} options={db.agendas.map((agenda) => agenda.code)} />
        <Field label="Ficheref" value={form.ficheref} onChange={(value) => setForm({ ...form, ficheref: value })} placeholder="fiche-reference.pdf" />
        <Field label="Appointement Date" type="date" value={form.dateRDV} onChange={(value) => setForm({ ...form, dateRDV: value })} />
        <label className="check-field">
          <input checked={form.confirmer} onChange={(event) => setForm({ ...form, confirmer: event.target.checked })} type="checkbox" />
          Confirm
        </label>
        <button className="primary-button" type="submit">ADD</button>
      </form>
    </>
  )
}

function ConfirmRdv({ db, commit }) {
  const [ip, setIp] = useState('')
  const [status, setStatus] = useState('Nonconfirmer')
  const rows = db.rdvs.filter((rdv) => {
    const statusMatch = status === 'Confirmer' ? rdv.confirmer : !rdv.confirmer
    return statusMatch && (!ip || rdv.ip.toLowerCase().includes(ip.toLowerCase()))
  })

  function confirm(idRDV) {
    commit(
      (current) => ({
        ...current,
        rdvs: current.rdvs.map((rdv) => (rdv.idRDV === idRDV ? { ...rdv, confirmer: true } : rdv)),
      }),
      'RDV confirme.',
    )
  }

  return (
    <>
      <PageHeader title="Confirmer Les RDV" />
      <section className="panel">
        <div className="filters">
          <input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="IP" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>Confirmer</option>
            <option>Nonconfirmer</option>
          </select>
        </div>
        <RdvTable rows={rows} actionLabel="Confirmer" onAction={(row) => confirm(row.idRDV)} />
      </section>
    </>
  )
}

function Patients({ db, commit }) {
  const emptyPatient = {
    ip: nextCode('IP', db.patients, 'ip'),
    nom: '',
    prenom: '',
    cin: '',
    telephone: '',
    organisme: db.organismes[0]?.nom || '',
    active: true,
  }
  const [form, setForm] = useState({
    ...emptyPatient,
  })
  const [editingIp, setEditingIp] = useState('')

  function submit(event) {
    event.preventDefault()
    if (editingIp) {
      commit(
        (current) => ({
          ...current,
          patients: current.patients.map((patient) => (patient.ip === editingIp ? form : patient)),
        }),
        'Patient modifie.',
      )
      setEditingIp('')
      setForm({ ...emptyPatient, ip: nextCode('IP', db.patients, 'ip') })
      return
    }

    commit((current) => ({ ...current, patients: [...current.patients, form] }), 'Patient ajoute.')
    setForm({ ...emptyPatient, ip: nextCode('IP', [...db.patients, form], 'ip') })
  }

  function editPatient(patient) {
    setEditingIp(patient.ip)
    setForm({ ...patient })
  }

  function deletePatient(ip) {
    commit(
      (current) => ({
        ...current,
        patients: current.patients.filter((patient) => patient.ip !== ip),
      }),
      'Patient supprime.',
    )
    if (editingIp === ip) {
      setEditingIp('')
      setForm({ ...emptyPatient, ip: nextCode('IP', db.patients, 'ip') })
    }
  }

  function cancelEdit() {
    setEditingIp('')
    setForm({ ...emptyPatient, ip: nextCode('IP', db.patients, 'ip') })
  }

  return (
    <>
      <PageHeader title="ADD Patient" parent="Parametrage" />
      <form className="panel form-grid" onSubmit={submit}>
        <Field label="Ip(identification Patient)" readOnly value={form.ip} />
        <Field label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
        <Field label="Prenom" value={form.prenom} onChange={(value) => setForm({ ...form, prenom: value })} />
        <Field label="CIN" value={form.cin} onChange={(value) => setForm({ ...form, cin: value })} />
        <Field label="Telephone" value={form.telephone} onChange={(value) => setForm({ ...form, telephone: value })} />
        <Select label="Organisme" value={form.organisme} onChange={(value) => setForm({ ...form, organisme: value })} options={db.organismes.map((organisme) => organisme.nom)} />
        <div className="form-actions">
          <button className="primary-button" type="submit">{editingIp ? 'Modifier' : 'Ajouter'}</button>
          {editingIp && (
            <button className="secondary-button" onClick={cancelEdit} type="button">Annuler</button>
          )}
        </div>
      </form>
      <SimpleTable
        rows={db.patients}
        columns={['ip', 'nom', 'prenom', 'cin', 'telephone', 'organisme']}
        actions={[
          { label: 'Modifier', onClick: editPatient },
          { label: 'Delete', danger: true, onClick: (patient) => deletePatient(patient.ip) },
        ]}
      />
    </>
  )
}

function Agenda({ db, commit }) {
  const [form, setForm] = useState({
    code: nextCode('AG', db.agendas, 'code'),
    description: '',
    specialite: db.services[0]?.specialite || '',
    jours: [],
    nombrePatients: 0,
  })
  const [newService, setNewService] = useState('')

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      jours: current.jours.includes(day) ? current.jours.filter((item) => item !== day) : [...current.jours, day],
    }))
  }

  function addService() {
    if (!newService.trim()) return
    commit(
      (current) => ({
        ...current,
        services: [...current.services, { id: nextCode('SRV', current.services, 'id'), specialite: newService.trim() }],
      }),
      'Service ajoute.',
    )
    setForm((current) => ({ ...current, specialite: newService.trim() }))
    setNewService('')
  }

  function submit(event) {
    event.preventDefault()
    commit((current) => ({ ...current, agendas: [...current.agendas, form] }), 'Agenda ajoute.')
    setForm((current) => ({
      ...current,
      code: nextCode('AG', [...db.agendas, form], 'code'),
      description: '',
      jours: [],
      nombrePatients: 0,
    }))
  }

  return (
    <>
      <PageHeader title="Agenda de consultation" parent="Parametrage" />
      <form className="panel form-grid" onSubmit={submit}>
        <Field label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
        <Field label="description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
        <Select label="Specialite" value={form.specialite} onChange={(value) => setForm({ ...form, specialite: value })} options={db.services.map((service) => service.specialite)} />
        <div className="inline-add">
          <input value={newService} onChange={(event) => setNewService(event.target.value)} placeholder="ADD Service" />
          <button type="button" onClick={addService}>Ajouter</button>
        </div>
        <div className="days-box">
          <span>Work days:</span>
          {weekDays.map((day) => (
            <label key={day}>
              <input checked={form.jours.includes(day)} onChange={() => toggleDay(day)} type="checkbox" />
              {day}
            </label>
          ))}
        </div>
        <Field label="patient Number" type="number" value={form.nombrePatients} onChange={(value) => setForm({ ...form, nombrePatients: Number(value) })} />
        <button className="primary-button" type="submit">Ajouter</button>
      </form>
      <SimpleTable rows={db.agendas} columns={['code', 'description', 'specialite', 'jours', 'nombrePatients']} />
    </>
  )
}

function Organismes({ db, commit }) {
  const [nom, setNom] = useState('')

  function submit(event) {
    event.preventDefault()
    commit(
      (current) => ({ ...current, organismes: [...current.organismes, { id: nextCode('ORG', current.organismes, 'id'), nom }] }),
      'Organisme ajoute.',
    )
    setNom('')
  }

  function deleteOrganisme(id) {
    commit(
      (current) => ({
        ...current,
        organismes: current.organismes.filter((organisme) => organisme.id !== id),
      }),
      'Organisme supprime.',
    )
  }

  return (
    <>
      <PageHeader title="Ajouter Organisme" parent="Parametrage" />
      <form className="panel inline-form" onSubmit={submit}>
        <Field label="Organisme" value={nom} onChange={setNom} />
        <button className="primary-button" type="submit">Ajouter</button>
      </form>
      <SimpleTable
        rows={db.organismes}
        columns={['id', 'nom']}
        actionLabel="Delete"
        onAction={(row) => deleteOrganisme(row.id)}
      />
    </>
  )
}

function Field({ label, value, onChange, type = 'text', readOnly = false, placeholder = '' }) {
  return (
    <label>
      <span>{label}</span>
      <input placeholder={placeholder} readOnly={readOnly} required type={type} value={value} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      <span>{label}</span>
      <select required value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function RdvTable({ rows, actionLabel, onAction }) {
  return (
    <table>
      <thead>
        <tr>
          <th>IdRDV</th>
          <th>Identification Patient</th>
          <th>Code Agenda</th>
          <th>Fiche De Reference</th>
          <th>Confirmation</th>
          <th>DateRDV</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.idRDV}>
            <td>{row.idRDV}</td>
            <td>{row.ip}</td>
            <td>{row.code}</td>
            <td>{row.ficheref}</td>
            <td>{row.confirmer ? 'Confirmer' : 'Nonconfirmer'}</td>
            <td>{row.dateRDV}</td>
            <td>
              <button className="table-button" onClick={() => onAction?.(row)} type="button">
                {actionLabel}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SimpleTable({ rows, columns, actionLabel, onAction, actions = [] }) {
  const tableActions = actions.length > 0 ? actions : onAction ? [{ label: actionLabel, onClick: onAction }] : []

  return (
    <section className="panel table-panel">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            {tableActions.length > 0 && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.ip || row.code || index}>
              {columns.map((column) => (
                <td key={column}>{Array.isArray(row[column]) ? row[column].join(', ') : String(row[column] ?? '')}</td>
              ))}
              {tableActions.length > 0 && (
                <td className="table-actions">
                  {tableActions.map((action) => (
                    <button
                      className={action.danger ? 'danger-button' : 'table-button'}
                      key={action.label}
                      onClick={() => action.onClick(row)}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default App
