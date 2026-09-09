import { useCallback, useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from './supabase'
import { demoCases, demoConflicts, demoEvents, demoPeople, demoSteps } from './data'
import type { Case, Conflict, Event, Person, Step, HrDocument } from './types'

export function useData<T>(table: string, fallback: T[]) {
  const [data, setData] = useState<T[]>(fallback)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const refetch = useCallback(async () => {
    if (!hasSupabaseConfig) return
    setLoading(true)
    const { data: rows, error } = await supabase.from(table).select('*')
    if (!error && rows) setData(rows as T[])
    setLoading(false)
  }, [table])
  useEffect(() => { void refetch() }, [refetch])
  return { data, loading, refetch, setData }
}
export const useCases = () => useData<Case>('hr_cases', demoCases)
export const useSteps = () => useData<Step>('hr_steps', demoSteps)
export const useEvents = () => useData<Event>('hr_events', demoEvents)
export const usePeople = () => useData<Person>('personnes', demoPeople)
export const useConflicts = () => useData<Conflict>('hr_conflicts', demoConflicts)

export function useManagerTasks(personId: number | undefined) {
  const [cases, setCases] = useState<Case[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(hasSupabaseConfig && personId != null)

  const refetch = useCallback(async () => {
    if (!hasSupabaseConfig || personId == null) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('hr_cases')
        .select(`
          *,
          hr_steps!inner(id, step_name, due_date, status, decision, owner_role, owner_person_id, case_id)
        `)
        .eq('hr_steps.owner_person_id', personId)
        .eq('hr_steps.status', 'PENDING')
        .order('due_date', { foreignTable: 'hr_steps' })

      if (!error && data) {
        // Flatten: each case can have multiple steps, we want both lists separate
        const allCases = data as any[]
        const allSteps: Step[] = []
        const uniqueCases: Map<string, Case> = new Map()

        for (const caseRow of allCases) {
          const caseKey = caseRow.case_id
          if (!uniqueCases.has(caseKey)) {
            const { hr_steps, ...caseData } = caseRow
            uniqueCases.set(caseKey, caseData as Case)
          }

          if (caseRow.hr_steps && Array.isArray(caseRow.hr_steps)) {
            for (const step of caseRow.hr_steps) {
              allSteps.push(step as Step)
            }
          }
        }

        setCases(Array.from(uniqueCases.values()))
        setSteps(allSteps)
      } else {
        // Fallback to demo data
        setCases(demoCases)
        setSteps(demoSteps.filter(s => s.status === 'PENDING'))
      }
    } catch {
      setCases(demoCases)
      setSteps(demoSteps.filter(s => s.status === 'PENDING'))
    }
    setLoading(false)
  }, [personId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { cases, steps, loading, refetch }
}

const demoDocuments: HrDocument[] = [
 {id:'DOC-001',person_id:1,employee_name:'Camille Martin',document_type:'EMPLOYMENT_CONTRACT',title:'Contrat de travail CDI',file_name:'contrat_camille_martin.pdf',file_url:null,status:'ARCHIVED',source:'GENERATED',created_at:'2026-09-01T09:00:00Z'},
 {id:'DOC-002',person_id:2,employee_name:'Yassine El Amrani',document_type:'WORK_ATTESTATION',title:'Attestation de travail',file_name:'attestation_yassine.pdf',file_url:null,status:'ARCHIVED',source:'GENERATED',created_at:'2026-09-03T09:00:00Z'}
]
export function useDocuments(){
  const [data,setData]=useState<HrDocument[]>(() => {
    try { const saved=localStorage.getItem('smartrh_documents'); return saved ? JSON.parse(saved) : demoDocuments } catch { return demoDocuments }
  })
  useEffect(()=>{ try { localStorage.setItem('smartrh_documents',JSON.stringify(data)) } catch {} },[data])
  const addDocument=(doc:Omit<HrDocument,'id'|'created_at'>)=>setData(v=>[{...doc,id:`DOC-${Date.now()}`,created_at:new Date().toISOString()},...v])
  const removeDocument=(id:string)=>setData(v=>v.filter(d=>d.id!==id))
  return {data,addDocument,removeDocument}
}
