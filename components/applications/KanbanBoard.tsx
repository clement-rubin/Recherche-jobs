'use client'

import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import type { Application, ApplicationStatus } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'

interface Props {
  applications: Application[]
  onUpdate: (id: string, data: Partial<Application>) => Promise<void>
}

const COLUMNS: { id: ApplicationStatus; label: string }[] = [
  { id: 'en_cours', label: 'En cours' },
  { id: 'relance', label: 'Relance' },
  { id: 'termine', label: 'Terminé' },
]

export function KanbanBoard({ applications, onUpdate }: Props) {
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const newStatus = result.destination.droppableId as ApplicationStatus
    const appId = result.draggableId
    const app = applications.find(a => a.id === appId)
    if (!app || app.statut === newStatus) return
    try {
      await onUpdate(appId, { statut: newStatus })
    } catch (err) {
      console.error('Failed to update application status:', err)
      // Parent will show error; no local state rollback needed (parent manages state)
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colApps = applications.filter(a => a.statut === col.id)
          return (
            <div key={col.id} className="bg-card border border-border rounded-xl">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <Badge status={col.id} />
                <span className="text-muted text-xs">{colApps.length}</span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-2 min-h-24 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-accent/5' : ''}`}
                  >
                    {colApps.map((app, index) => (
                      <Draggable key={app.id} draggableId={app.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-background border rounded-lg p-3 transition-shadow ${snapshot.isDragging ? 'shadow-lg border-accent' : 'border-border'}`}
                          >
                            <p className="text-foreground text-sm font-medium">{app.entreprise}</p>
                            <p className="text-muted text-xs mt-0.5">{app.poste}</p>
                            {app.type_contrat && (
                              <p className="text-muted text-xs mt-1 capitalize">{app.type_contrat}</p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colApps.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-muted text-xs text-center py-4">Aucune candidature</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
