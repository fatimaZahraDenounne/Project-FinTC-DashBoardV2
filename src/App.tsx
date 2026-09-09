import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, Bell, Check, ChevronRight, CircleAlert, Clock3, FileCheck2, Gavel, LayoutDashboard, Menu, ShieldAlert, UserPlus, UserRound, X, FolderOpen, Search, Sun, Sparkles, FileText, ClipboardList, BarChart2 } from 'lucide-react'
import logo from './components/Logo.jpeg'
import { hasSupabaseConfig } from './supabase'
import { useCases, useConflicts, useEvents, useManagerTasks, usePeople, useSteps } from './hooks'
import Intake from './pages/Intake'
import Documents from './pages/Documents'
import StepRow from './components/StepRow'
import DecisionBadge from './components/DecisionBadge'
import DecisionPanel from './components/DecisionPanel'
import { DetailsList } from './components/DetailsFields'
import type { Case, Event, Person, Step } from './types'

const TERMINAL_DECISIONS = ['EXTEND', 'TERMINATE', 'CONFIRM', 'RENEW', 'OFFBOARD']

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(value)) : '—'
const formatTime = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const journeyLabel = (value: string) => ({ probation: "Période d'essai", renewal: 'Renouvellement', offboarding: 'Départ' }[value] || value)
const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2)

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge status-${status.toLowerCase()}`}><span className="badge-dot" />{status}</span>
}
function RiskBadge({ risk }: { risk: string }) { return <span className={`badge risk-${risk.toLowerCase()}`}>{risk}</span> }
function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: string }) {
  return <div className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon size={18} /></div><div><div className="kpi-value">{value}</div><div className="kpi-label">{label}</div></div><ArrowUpRight className="kpi-arrow" size={16} /></div>
}
function SectionCard({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="section-card"><div className="section-head"><div><p className="eyebrow">{eyebrow || 'Suivi opérationnel'}</p><h2>{title}</h2></div>{action}</div>{children}</section>
}
function EmptyState({ text = 'Aucun élément à afficher' }: { text?: string }) { return <div className="empty-state"><Check size={17} />{text}</div> }
function Toast({ message, onClose }: { message: string; onClose: () => void }) { return <div className="toast"><CircleAlert size={18} /><span>{message}</span><button onClick={onClose} aria-label="Fermer"><X size={15} /></button></div> }

function ActorSelect({ people, actor, setActor }: { people: Person[]; actor: string; setActor: (value: string) => void }) {
  return <label className="actor-select"><span className="actor-avatar"><UserRound size={15} /></span><span className="actor-label">I am</span><select value={actor} onChange={event => setActor(event.target.value)}>{people.filter(person => ['manager', 'encadrant', 'rh', 'paie', 'it', 'moyens_generaux'].includes(person.role)).map(person => <option key={person.person_ref} value={person.person_ref}>{person.full_name}</option>)}</select></label>
}

function Dashboard({ cases, steps, events, conflicts, onOpen }: { cases: Case[]; steps: Step[]; events: Event[]; conflicts: ReturnType<typeof useConflicts>['data']; onOpen: (caseId: string) => void }) {
  const today = new Date()
  const in7 = new Date(today.getTime() + 7 * 86400000)
  const in14 = new Date(today.getTime() + 14 * 86400000)
  const openCases = cases.filter(item => item.status !== 'CLOSED')
  const deadlines = steps.filter(step => ['PENDING', 'OVERDUE'].includes(step.status) && new Date(step.due_date) <= in7).length
  const late = steps.filter(step => step.status === 'OVERDUE').length
  const blocked = cases.filter(item => item.status === 'BLOCKED').length || steps.filter(item => item.status === 'BLOCKED').length
  const highRisk = cases.filter(item => item.risk_level === 'HIGH').length
  const docs = events.filter(item => /DOCUMENT|GENERATED|UPLOAD/i.test(item.event_type)).length
  const probation = cases.filter(item => item.journey_type === 'probation').length
  const renewal = cases.filter(item => item.journey_type === 'renewal').length
  const offboarding = cases.filter(item => item.journey_type === 'offboarding').length
  const totalJourneys = Math.max(probation + renewal + offboarding, 1)
  const upcoming = [...steps].filter(step => ['PENDING','OVERDUE'].includes(step.status) && new Date(step.due_date) <= in14).sort((a,b)=>+new Date(a.due_date)-+new Date(b.due_date)).slice(0,5)
  const recent = [...events].sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at)).slice(0,5)
  const urgentTasks = [...steps].filter(step => ['PENDING','OVERDUE'].includes(step.status)).sort((a,b)=>+new Date(a.due_date)-+new Date(b.due_date)).slice(0,5)
  const risks = [...cases].sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.risk_level]-{HIGH:0,MEDIUM:1,LOW:2}[b.risk_level])).slice(0,5)
  const pathPoints = '12,92 90,70 170,76 250,52 330,59 410,37 490,22 570,16'
  const renewalPoints = '12,104 90,92 170,84 250,74 330,70 410,65 490,48 570,42'
  const offPoints = '12,112 90,106 170,102 250,92 330,88 410,91 490,84 570,76'
  const Kpi = ({label,value,icon:Icon,tone,trend}:{label:string;value:number;icon:any;tone:string;trend:string}) => <div className="smart-kpi"><div className={`smart-kpi-icon ${tone}`}><Icon size={22}/></div><div className="smart-kpi-copy"><span>{label}</span><strong>{value}</strong><small>{trend}</small></div><svg className="mini-spark" viewBox="0 0 70 26" preserveAspectRatio="none"><path d="M2 22 C15 17 20 20 29 13 S43 19 52 9 S61 13 68 3" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>
  return <div className="dashboard-v2">
    <div className="dashboard-v2-head">
      <div><p className="dash-overline">TABLEAU DE BORD RH</p><h1>Bonjour Fatima Zahra ! <span>👋</span></h1><p>Voici un aperçu clair de la situation actuelle de vos ressources humaines.</p></div>
      <div className="dash-head-actions"><div className="dash-date"><Clock3 size={18}/><span>{new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(today)}<small>Mis à jour à l'instant</small></span></div><div className="smart-pill"><Sparkles size={19}/><div><b>SmartRH</b><span>Gestion RH intelligente</span></div></div></div>
    </div>

    <div className="smart-kpis">
      <Kpi label="Total des dossiers" value={openCases.length} icon={UserRound} tone="blue" trend="↗ +12% ce mois"/>
      <Kpi label="Échéances proches" value={deadlines} icon={Clock3} tone="green" trend="↗ À surveiller"/>
      <Kpi label="Tâches en retard" value={late} icon={AlertTriangle} tone="orange" trend={late ? 'Action requise' : 'Aucun retard'}/>
      <Kpi label="Dossiers bloqués" value={blocked} icon={ShieldAlert} tone="red" trend={blocked ? 'À traiter' : 'Situation stable'}/>
      <Kpi label="Risque élevé" value={highRisk} icon={Activity} tone="purple" trend={highRisk ? 'Analyse prioritaire' : 'Risque maîtrisé'}/>
    </div>

    <div className="smart-dashboard-grid">
      <section className="smart-card evolution-card">
        <div className="smart-card-head"><div><div className="smart-title"><BarChart3 size={18}/>Évolution des dossiers RH</div><span>Suivi des 6 derniers mois</span></div><button className="smart-link">6 derniers mois <ChevronRight size={14}/></button></div>
        <div className="chart-wrap"><svg viewBox="0 0 590 130" className="line-chart"><g className="chart-grid"><line x1="10" y1="20" x2="580" y2="20"/><line x1="10" y1="55" x2="580" y2="55"/><line x1="10" y1="90" x2="580" y2="90"/><line x1="10" y1="120" x2="580" y2="120"/></g><polyline points={pathPoints} fill="none" stroke="#2f7bd8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><polyline points={renewalPoints} fill="none" stroke="#39aa83" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><polyline points={offPoints} fill="none" stroke="#7d63d6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="chart-months"><span>Avr</span><span>Mai</span><span>Juin</span><span>Juil</span><span>Août</span><span>Sep</span></div></div>
        <div className="chart-legend"><span><i className="dot blue"/>Probation</span><span><i className="dot green"/>Renouvellement</span><span><i className="dot purple"/>Offboarding</span></div>
      </section>

      <section className="smart-card distribution-card"><div className="smart-card-head"><div><div className="smart-title"><Activity size={18}/>Répartition des parcours</div><span>Portefeuille actuel</span></div></div><div className="distribution-content"><div className="donut" style={{background:`conic-gradient(#2f7bd8 0 ${(probation/totalJourneys)*100}%, #39aa83 ${(probation/totalJourneys)*100}% ${((probation+renewal)/totalJourneys)*100}%, #7d63d6 ${((probation+renewal)/totalJourneys)*100}% 100%)`}}><div><b>{cases.length}</b><span>Total</span></div></div><div className="distribution-list"><span><i className="dot blue"/>Probation <b>{Math.round(probation/totalJourneys*100)}%</b></span><span><i className="dot green"/>Renouvellement <b>{Math.round(renewal/totalJourneys*100)}%</b></span><span><i className="dot purple"/>Offboarding <b>{Math.round(offboarding/totalJourneys*100)}%</b></span></div></div></section>

      <section className="smart-card notifications-card"><div className="smart-card-head"><div className="smart-title"><Bell size={18}/>Alertes & Notifications</div><button className="smart-link">Voir tout</button></div><div className="notification-list">{recent.length ? recent.map((event,index)=><div className="notice" key={event.id}><div className={`notice-icon n${index%4}`}><Bell size={14}/></div><div><b>{event.note || event.event_type}</b><span>{event.actor || 'SmartRH'}</span></div><small>{formatTime(event.created_at)}</small></div>) : <EmptyState text="Aucune notification récente"/>}</div></section>

      <section className="smart-card urgent-card"><div className="smart-card-head"><div className="smart-title"><ClipboardList size={18}/>Tâches et échéances urgentes</div><button className="smart-link" onClick={()=>window.location.assign('/tasks')}>Voir tout</button></div><div className="smart-table"><div className="smart-table-head"><span>Collaborateur</span><span>Tâche</span><span>Échéance</span><span>Priorité</span></div>{urgentTasks.length ? urgentTasks.map(step=><button key={step.id} className="smart-table-row" onClick={()=>onOpen(step.case_id)}><span><i className="avatar-dot">{initials(step.owner?.full_name || step.owner_role || 'RH')}</i>{step.owner?.full_name || step.owner_role || 'Responsable RH'}</span><span>{step.step_name}</span><span className={new Date(step.due_date)<today?'danger-date':''}>{formatDate(step.due_date)}</span><span><StatusBadge status={step.status}/></span></button>) : <EmptyState text="Aucune tâche urgente"/>}</div></section>

      <section className="smart-card activity-card"><div className="smart-card-head"><div className="smart-title"><Activity size={18}/>Dernières activités</div><button className="smart-link">Voir tout</button></div><div className="activity-list">{recent.length ? recent.map((event,index)=><div className="activity-row" key={event.id}><div className={`activity-icon a${index%5}`}><FileText size={14}/></div><div><b>{event.actor || 'SmartRH'}</b><span>{event.note || event.event_type}</span></div><small>{formatTime(event.created_at)}</small></div>) : <EmptyState/>}</div></section>

      <section className="smart-card deadlines-card"><div className="smart-card-head"><div className="smart-title"><Clock3 size={18}/>Prochains délais</div><button className="smart-link">Voir tout</button></div><div className="deadline-list">{upcoming.length ? upcoming.map(step=>{const days=Math.max(0,Math.ceil((new Date(step.due_date).getTime()-today.getTime())/86400000));return <button className="deadline-row" key={step.id} onClick={()=>onOpen(step.case_id)}><div className="deadline-date"><b>{formatDate(step.due_date).split(' ')[0]}</b><span>sept.</span></div><div><b>{step.step_name}</b><span>{step.owner?.full_name || step.owner_role}</span></div><em className={days<=1?'urgent':days<=3?'soon':''}>{days<=0?'Urgent':`Sous ${days} jours`}</em></button>}) : <EmptyState/>}</div></section>

      <section className="smart-card quick-card"><div className="smart-card-head"><div className="smart-title"><Sparkles size={18}/>Actions rapides</div></div><div className="quick-actions"><button onClick={()=>window.location.assign('/intake')}><UserPlus size={17}/>Nouveau dossier RH<ChevronRight size={15}/></button><button onClick={()=>window.location.assign('/documents')}><FileText size={17}/>Générer / gérer un document<ChevronRight size={15}/></button><button onClick={()=>window.location.assign('/tasks')}><Check size={17}/>Voir mes tâches<ChevronRight size={15}/></button><button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><BarChart2 size={17}/>Consulter les rapports<ChevronRight size={15}/></button></div></section>

      <section className="smart-card risk-card"><div className="smart-card-head"><div className="smart-title"><AlertTriangle size={18}/>Top 5 des risques</div><button className="smart-link">Voir tout</button></div><div className="risk-people">{risks.length ? risks.map(item=><button key={item.case_id} onClick={()=>onOpen(item.case_id)}><div className="risk-person"><i className="avatar-dot">{initials(item.subject?.full_name || item.case_id)}</i><span><b>{item.subject?.full_name || item.case_id}</b><small>{journeyLabel(item.journey_type)}</small></span></div><RiskBadge risk={item.risk_level}/></button>) : <EmptyState/>}</div></section>
    </div>

    <div className="smart-bottom-banner"><div><span className="banner-icon"><BarChart3 size={22}/></span><div><b>Optimisez votre gestion RH avec SmartRH</b><p>Des données claires, des alertes intelligentes et un suivi plus rapide de vos parcours.</p></div></div><button onClick={()=>setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),0)}>Explorer les fonctionnalités <ChevronRight size={16}/></button></div>
  </div>
}function CaseList({ items, showDate = false, onOpen }: { items: Case[]; showDate?: boolean; onOpen?: (caseId: string) => void }) { return items.length ? <div className="compact-list">{items.map(item => <button className="compact-row compact-button" key={item.case_id} onClick={() => onOpen?.(item.case_id)}><div className="case-avatar">{initials(item.subject?.full_name || '?')}</div><div className="row-main"><strong>{item.subject?.full_name || item.case_id}</strong><span>{journeyLabel(item.journey_type)} · {item.case_id}</span></div>{showDate ? <span className="date">{formatDate(item.contract_end_date)}</span> : <RiskBadge risk={item.risk_level} />}</button>)}</div> : <EmptyState /> }
function StepList({ items }: { items: Step[] }) { return items.length ? <div className="compact-list">{items.map(item => <div className="compact-row" key={item.id}><div className="tiny-icon"><FileCheck2 size={15} /></div><div className="row-main"><strong>{item.step_name}</strong><span>{item.case_id} · {item.owner?.full_name || item.owner_role}</span></div><span className="date">{formatDate(item.due_date)}</span></div>)}</div> : <EmptyState /> }
function ConflictList({ conflicts }: { conflicts: ReturnType<typeof useConflicts>['data'] }) { return conflicts.length ? <div className="compact-list">{conflicts.map(item => <div className="compact-row" key={item.id}><div className="tiny-icon coral"><AlertTriangle size={15} /></div><div className="row-main"><strong>{item.description}</strong><span>{item.case_id} · Ouvert le {formatDate(item.opened_at)}</span></div></div>)}</div> : <EmptyState /> }
function DecisionFeed({ events, onOpen }: { events: Event[]; onOpen: (caseId: string) => void }) {
  return events.length ? <div className="compact-list">{events.map(event => <button className="compact-row compact-button" key={event.id} onClick={() => onOpen(event.case_id)}><div className="tiny-icon"><Gavel size={15} /></div><div className="row-main"><strong>{event.case_id}</strong><span>{event.actor} · {formatTime(event.created_at)}</span></div><DecisionBadge decision={event.decision} /></button>)}</div> : <EmptyState text="Aucune décision enregistrée" />
}
function BlockReasons({ rows }: { rows: [string, number][] }) {
  return rows.length ? <div className="compact-list">{rows.map(([reason, count]) => <div className="compact-row" key={reason}><div className="tiny-icon coral"><ShieldAlert size={15} /></div><div className="row-main"><strong><DecisionLabel decision={reason} /></strong><span>{count} dossier{count > 1 ? 's' : ''} bloqué{count > 1 ? 's' : ''}</span></div><span className="count-pill">{count}</span></div>)}</div> : <EmptyState text="Aucun blocage" />
}
function DecisionLabel({ decision }: { decision: string }) {
  if (decision === 'Non précisé') return <>Non précisé</>
  return <DecisionBadge decision={decision} />
}

function Tasks({ actor, steps, cases, onValidated }: { actor: string; steps: Step[]; cases: Case[]; onValidated: () => void }) {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const stepsByCase = useMemo(() => {
    const grouped: Record<string, Step[]> = {}
    for (const step of steps) {
      if (!grouped[step.case_id]) grouped[step.case_id] = []
      grouped[step.case_id].push(step)
    }
    return grouped
  }, [steps])

  return <><div className="page-intro compact"><div><p className="eyebrow">Mon espace de travail</p><h1>Mes tâches <span className="count-pill">{cases.length}</span></h1><p className="subtle">Les stagiaires qui attendent votre validation.</p></div></div><section className="table-card"><div className="table-toolbar"><div><strong>À traiter maintenant</strong><span>Priorisées par échéance</span></div><span className="filter-chip"><Activity size={14} /> {actor}</span></div><div className="task-table"><div className="task-header"><span>Dossier</span><span>Tâches en attente</span><span>Prochaine échéance</span><span>Statut</span></div>{cases.length ? cases.map(caseItem => {
    const caseSteps = (stepsByCase[caseItem.case_id] || []).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    if (caseSteps.length === 0) return null
    const isExpanded = expandedCaseId === caseItem.case_id
    const nextStep = caseSteps[0]
    const hasOverdue = caseSteps.some(s => s.status === 'OVERDUE')
    return <div key={caseItem.case_id}>
      <button className="task-item compact-button" onClick={() => setExpandedCaseId(isExpanded ? null : caseItem.case_id)} style={{cursor: 'pointer'}}>
        <div className="task-row">
          <div><strong>{caseItem.subject?.full_name || caseItem.case_id}</strong><span>{caseItem.case_id}{caseItem.subject?.person_ref ? ` · ${caseItem.subject.person_ref}` : ''}</span></div>
          <div><span className="muted">{caseSteps.length} étape{caseSteps.length > 1 ? 's' : ''}</span></div>
          <div className={hasOverdue ? 'date overdue' : 'date'}>{formatDate(nextStep.due_date)}<small>{hasOverdue ? 'En retard' : 'À venir'}</small></div>
          <StatusBadge status={hasOverdue ? 'OVERDUE' : 'PENDING'} />
        </div>
      </button>
      {isExpanded && <div className="nested-steps">{caseSteps.map(step => (
        <div className="task-item nested" key={step.id}>
          <div className="task-row">
            <div className="task-step">{step.step_name}</div>
            <div className={step.status === 'OVERDUE' ? 'date overdue' : 'date'}>{formatDate(step.due_date)}<small>{step.status === 'OVERDUE' ? 'En retard' : 'À venir'}</small></div>
            <StatusBadge status={step.status} />
            <div className="task-decision">{step.decision ? <DecisionBadge decision={step.decision} /> : <span className="muted">—</span>}</div>
          </div>
          <div className="task-panel">
            <DecisionPanel step={{ id: step.id, case_id: step.case_id, owner_role: step.owner_role }} actor={actor} journeyType={caseItem.journey_type || ''} onSuccess={onValidated} />
          </div>
        </div>
      ))}</div>}
    </div>
  }) : <EmptyState text="Aucune tâche ouverte pour cet acteur" />}</div></section></>
}

function CaseDetail({ selectedCase, steps, events, conflicts, actor, onValidated }: { selectedCase: Case; steps: Step[]; events: Event[]; conflicts: ReturnType<typeof useConflicts>['data']; actor: string; onValidated: () => void }) {
  const caseSteps = steps.filter(step => step.case_id === selectedCase.case_id); const top = caseSteps.filter(step => !step.parent_step_id)
  return <><div className="detail-header"><div className="back-label">Dossier / {selectedCase.case_id}</div><div className="detail-title"><div className="case-avatar large">{initials(selectedCase.subject?.full_name || '?')}</div><div><h1>{selectedCase.subject?.full_name}</h1><p>{journeyLabel(selectedCase.journey_type)} · {selectedCase.case_id}</p></div><StatusBadge status={selectedCase.status} /><RiskBadge risk={selectedCase.risk_level} /></div><div className="detail-meta"><span><b>Début</b>{formatDate(selectedCase.start_date)}</span><span><b>Fin de contrat</b>{formatDate(selectedCase.contract_end_date)}</span><span><b>Étapes</b>{caseSteps.filter(step => step.status === 'VALIDATED').length}/{caseSteps.length} validées</span></div></div><div className="detail-grid"><SectionCard title="Parcours de validation" eyebrow="Étapes du dossier"><div className="step-tree">{top.length ? top.map(step => <div key={step.id}><StepRow step={step} actor={actor} journeyType={selectedCase.journey_type} onValidateSuccess={onValidated} />{caseSteps.filter(child => child.parent_step_id === step.id).map(child => <StepRow key={child.id} step={child} actor={actor} journeyType={selectedCase.journey_type} onValidateSuccess={onValidated} nested />)}</div>) : <EmptyState />}</div></SectionCard><div className="side-stack"><SectionCard title="Chronologie" eyebrow="Dernières activités"><Timeline events={events.filter(event => event.case_id === selectedCase.case_id)} /></SectionCard><SectionCard title="Conflits" eyebrow="Signalements"><ConflictList conflicts={conflicts.filter(item => item.case_id === selectedCase.case_id)} /></SectionCard></div></div></>
}

function OperationalPage({ title, subtitle, items, icon: Icon, onOpen }: { title:string; subtitle:string; items:{title:string; meta:string; status?:string; id:string}[]; icon:any; onOpen?: (id:string)=>void }) {
  const [query,setQuery]=useState('')
  const rows=items.filter(i=>`${i.title} ${i.meta}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="operational-page"><div className="page-intro compact"><div><p className="eyebrow">SmartRH · Opérations</p><h1>{title}</h1><p className="subtle">{subtitle}</p></div></div><section className="table-card"><div className="documents-toolbar"><div><strong>{rows.length} élément(s)</strong><span>Recherche et consultation</span></div><label className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher..."/></label></div><div className="op-list">{rows.map(item=><button className="op-row" key={item.id} onClick={()=>onOpen?.(item.id)}><span className="op-icon"><Icon size={18}/></span><span><strong>{item.title}</strong><small>{item.meta}</small></span>{item.status&&<StatusBadge status={item.status}/>}<ChevronRight size={17}/></button>)}{!rows.length&&<EmptyState/>}</div></section></div>
}

function Timeline({ events }: { events: Event[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return events.length ? <div className="timeline">{[...events].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map(event => {
    const hasDetails = event.details && Object.keys(event.details).length > 0
    return <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><div className="timeline-top"><strong>{event.event_type}</strong><small>{formatTime(event.created_at)}</small></div>{event.decision && <div className="timeline-decision"><DecisionBadge decision={event.decision} /></div>}<p>{event.note || 'Événement enregistré'}</p><span className="timeline-actor">{event.actor}</span>{hasDetails && <button className="timeline-toggle" onClick={() => setOpen(open === event.id ? null : event.id)}>{open === event.id ? 'Masquer les détails' : 'Voir les détails'}</button>}{open === event.id && <DetailsList details={event.details} />}</div></div>
  })}</div> : <EmptyState text="Aucun événement" />
}

export default function App() {
  const { data: cases, refetch: refetchCases } = useCases(); const { data: steps, refetch: refetchSteps } = useSteps(); const { data: events, refetch: refetchEvents } = useEvents(); const { data: people } = usePeople(); const { data: conflicts } = useConflicts()
  const [actor, setActor] = useState('MGR-004'); const [page, setPage] = useState(window.location.pathname); const [toast, setToast] = useState(''); const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.case_id || 'CASE-PRO-STG-001')
  const navigate = (path: string) => { window.history.pushState({}, '', path); setPage(path) }

  // Manager-specific tasks from Supabase query
  const actorPerson = people.find(p => p.person_ref === actor)
  const { cases: managerCases, steps: managerSteps, refetch: refetchManagerTasks } = useManagerTasks(actorPerson?.id)

  const decoratedCases = useMemo(() => cases.map(item => ({ ...item, subject: item.subject || people.find(person => person.id === item.subject_person_id) })), [cases, people])
  const selectedCase = decoratedCases.find(item => item.case_id === selectedCaseId) || decoratedCases[0]
  const decoratedSteps = useMemo(() => steps.map(step => ({ ...step, owner: step.owner || people.find(person => person.id === step.owner_person_id) })), [steps, people])
  const decoratedManagerSteps = useMemo(() => managerSteps.map(step => ({ ...step, owner: step.owner || people.find(person => person.id === step.owner_person_id) })), [managerSteps, people])
  const decoratedManagerCases = useMemo(() => managerCases.map(item => ({ ...item, subject: item.subject || people.find(person => person.id === item.subject_person_id) })), [managerCases, people])
  const refetchAll = () => Promise.all([refetchSteps(), refetchCases(), refetchEvents(), refetchManagerTasks()])
  // Fusion processes the decision asynchronously, so poll a few times for the DB write to land.
  const onValidated = async () => {
    setToast('Décision enregistrée — synchronisation…')
    for (const delay of [0, 2500, 6000]) {
      await new Promise(resolve => setTimeout(resolve, delay))
      await refetchAll()
    }
    setToast('Décision enregistrée')
  }
  const openCase = (caseId: string) => { setSelectedCaseId(caseId); navigate(`/case/${caseId}`) }
  const pageContent = page === '/intake' ? <Intake /> : page === '/documents' ? <Documents /> : page === '/tasks' ? <Tasks actor={actor} steps={decoratedManagerSteps} cases={decoratedManagerCases} onValidated={onValidated} /> : page === '/journeys' ? <OperationalPage title="Parcours RH" subtitle="Suivez les parcours de probation, renouvellement et départ." icon={ClipboardList} items={decoratedCases.map(c=>({id:c.case_id,title:c.subject?.full_name || c.case_id,meta:journeyLabel(c.journey_type),status:c.status}))} onOpen={openCase}/> : page === '/cases' ? <OperationalPage title="Dossiers RH" subtitle="Consultez tous les dossiers et leur état d'avancement." icon={FolderOpen} items={decoratedCases.map(c=>({id:c.case_id,title:c.subject?.full_name || c.case_id,meta:`${journeyLabel(c.journey_type)} · ${c.case_id}`,status:c.status}))} onOpen={openCase}/> : page === '/alerts' ? <OperationalPage title="Alertes & Notifications" subtitle="Centralisez les échéances et événements à surveiller." icon={Bell} items={decoratedSteps.filter(s=>['PENDING','OVERDUE','BLOCKED'].includes(s.status)).map(s=>({id:String(s.id),title:s.step_name,meta:`Échéance : ${formatDate(s.due_date)}`,status:s.status}))}/> : page === '/conflicts' ? <OperationalPage title="Conflits" subtitle="Suivi des conflits et situations nécessitant une intervention." icon={ShieldAlert} items={conflicts.map(c=>({id:String(c.id),title:(c as any).title || `Conflit ${c.id}`,meta:(c as any).description || `Dossier ${(c as any).case_id}`,status:(c as any).status || 'OPEN'}))}/> : page === '/reports' ? <OperationalPage title="Rapports & KPI" subtitle="Synthèse opérationnelle des indicateurs RH actuels." icon={BarChart2} items={[{id:'1',title:`${cases.length} dossiers suivis`,meta:'Indicateur global',status:'ACTIVE'},{id:'2',title:`${steps.filter(s=>s.status==='OVERDUE').length} tâches en retard`,meta:'À traiter en priorité',status:'OVERDUE'},{id:'3',title:`${conflicts.length} conflits enregistrés`,meta:'Suivi des signalements',status:'OPEN'}]}/> : page === '/ai' ? <OperationalPage title="Analyse IA" subtitle="Priorisation des dossiers selon leur niveau de risque." icon={Sparkles} items={decoratedCases.sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.risk_level]-{HIGH:0,MEDIUM:1,LOW:2}[b.risk_level])).map(c=>({id:c.case_id,title:c.subject?.full_name || c.case_id,meta:`Niveau de risque : ${c.risk_level}`,status:c.status}))} onOpen={openCase}/> : page.startsWith('/case/') && selectedCase ? <CaseDetail selectedCase={selectedCase} steps={decoratedSteps} events={events} conflicts={conflicts} actor={actor} onValidated={onValidated} /> : <Dashboard cases={decoratedCases} steps={decoratedSteps} events={events} conflicts={conflicts} onOpen={openCase} />
  return <div className="app-shell pro-shell">
    <aside className="sidebar pro-sidebar">
      <div className="brand"><img src={logo} alt="smartRH — Intelligent HR Tracking System" className="brand-logo" /></div>
      <nav className="pro-nav">
        <button className={page === '/' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/')}><LayoutDashboard size={18} />Tableau de bord</button>
        <button className="nav-item" onClick={() => navigate('/journeys')}><ClipboardList size={18} />Parcours RH<ChevronRight size={15} className="nav-chevron" /></button>
        <button className={page.startsWith('/case/') ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/cases')}><FolderOpen size={18} />Dossiers<span className="nav-count">{cases.length}</span></button>
        <button className={page === '/tasks' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/tasks')}><Check size={18} />Tâches<span className="nav-count">{decoratedManagerSteps.filter(step => ['PENDING', 'OVERDUE'].includes(step.status)).length}</span></button>
        <button className={page === '/documents' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/documents')}><FileText size={18} />Documents RH</button>
        <button className="nav-item" onClick={() => navigate('/alerts')}><Bell size={18} />Alertes & Notifications<span className="nav-count">{events.filter(e=>e.event_type==='ESCALATED').length}</span></button>
        <button className="nav-item" onClick={() => navigate('/ai')}><Sparkles size={18} />Analyse IA</button>
        <button className="nav-item" onClick={() => navigate('/conflicts')}><ShieldAlert size={18} />Conflits</button>
        <button className="nav-item" onClick={() => navigate('/reports')}><BarChart2 size={18} />Rapports & KPI</button>
        <button className={page === '/intake' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/intake')}><UserPlus size={18} />Nouveau dossier</button>
      </nav>
      <div className="sidebar-user"><div className="profile-avatar">FZ</div><div><strong>Fatima Zahra</strong><span>Responsable RH</span></div><ChevronRight size={16}/></div>
      <div className="sidebar-foot"><div className="sync-line"><div className="sync-dot" />{hasSupabaseConfig ? 'Supabase connecté' : 'Mode démonstration'}</div><small>SmartRH · HR Operations</small></div>
    </aside>
    <main className="main pro-main">
      <header className="topbar pro-topbar">
        <button className="mobile-menu"><Menu size={19} /></button>
        <label className="global-search"><Search size={18}/><input placeholder="Rechercher un collaborateur, un dossier, un document..."/><kbd>⌘ K</kbd></label>
        <div className="top-actions"><button className="icon-action notification" onClick={()=>setToast('Aucune nouvelle notification critique')}><Bell size={19}/><span>{events.filter(e=>e.event_type==='ESCALATED').length || 3}</span></button><button className="icon-action"><Sun size={19}/></button><div className="top-profile"><div className="profile-avatar small">FZ</div><div><strong>Fatima Zahra</strong><span>Responsable RH</span></div><ChevronRight size={15}/></div></div>
      </header>
      <div className="content">{pageContent}</div>
    </main>
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </div>
}
