
import { useMemo } from 'react'
import { Ic, Btn } from '../ui'

function formatDate(value) {
  if (!value) return 'Every applicable day'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(value) {
  if (!value) return 'Any time'

  const [h, m = 0] = String(value)
    .split(':')
    .map(Number)

  if (Number.isNaN(h)) {
    return String(value)
  }

  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${
    h >= 12 ? 'PM' : 'AM'
  }`
}

function statusMeta(status) {
  switch (String(status || '').toLowerCase()) {
    case 'completed':
      return {
        label: 'Completed',
        bg: '#ecfdf3',
        fg: '#027a48',
        icon: 'CheckCircle',
      }

    case 'completed late':
    case 'completed_late':
      return {
        label: 'Completed late',
        bg: '#fff7ed',
        fg: '#c2410c',
        icon: 'CheckCircle',
      }

    case 'overdue':
      return {
        label: 'Overdue',
        bg: '#fef3f2',
        fg: '#b42318',
        icon: 'AlertTriangle',
      }

    case 'due soon':
      return {
        label: 'Due soon',
        bg: '#fffaeb',
        fg: '#b54708',
        icon: 'Activity',
      }

    case 'upcoming':
      return {
        label: 'Upcoming',
        bg: '#eff8ff',
        fg: '#175cd3',
        icon: 'RefreshCw',
      }

    case 'inactive':
      return {
        label: 'Inactive',
        bg: '#f2f4f7',
        fg: '#667085',
        icon: 'ToggleLeft',
      }

    default:
      return {
        label: 'Pending',
        bg: '#f2f4f7',
        fg: '#475467',
        icon: 'ClipboardList',
      }
  }
}

function priorityMeta(priority) {
  switch (String(priority || '').toLowerCase()) {
    case 'urgent':
      return {
        bg: '#fef3f2',
        fg: '#b42318',
        label: 'Urgent',
      }

    case 'high':
      return {
        bg: '#fff7ed',
        fg: '#c2410c',
        label: 'High',
      }

    case 'low':
      return {
        bg: '#f2f4f7',
        fg: '#667085',
        label: 'Low',
      }

    default:
      return {
        bg: '#eff8ff',
        fg: '#175cd3',
        label: 'Medium',
      }
  }
}

export default function AssignmentCard({
  assignment,
  managerName = '',
  branchName = '',
  onEdit,
  onDelete,
  onView,
  onComplete,
  showActions = true,
  theme = null,
}) {
  const task =
    assignment && typeof assignment === 'object'
      ? assignment
      : {}

  const surface =
    theme?.cardBg || '#fff'

  const text =
    theme?.text || '#101828'

  const muted =
    theme?.textMuted || '#667085'

  const border =
    theme?.border || '#e4e7ec'

  const status =
    task.calculated_status ||
    task.status ||
    'Pending'

  const sm = statusMeta(status)
  const pm = priorityMeta(task.priority)

  const recurrence = useMemo(() => {
    const value = String(
      task.recurrence || 'daily'
    ).replaceAll('_', ' ')

    if (value === 'one time') {
      return 'One time'
    }

    return (
      value.charAt(0).toUpperCase() +
      value.slice(1)
    )
  }, [task.recurrence])

  const completion = task.completion

  const completed =
    String(status).toLowerCase() === 'completed' ||
    String(status).toLowerCase() === 'completed late'

  const safeTimeLimit =
    Number(task.time_limit_minutes || 0)

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 14,
        background: surface,
        padding: 16,
        boxShadow:
          '0 1px 2px rgba(16,24,40,.04)',
        transition:
          'box-shadow .15s, transform .15s',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 11,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: sm.bg,
              color: sm.fg,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Ic
              n={sm.icon}
              size={19}
            />
          </div>

          <div
            style={{
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 7,
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: text,
                  fontSize: 14.5,
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {task.title ||
                  task.name ||
                  'Untitled Task'}
              </h3>

              <Badge
                bg={pm.bg}
                fg={pm.fg}
              >
                {pm.label}
              </Badge>
            </div>

            {task.description && (
              <p
                style={{
                  margin: '5px 0 0',
                  color: muted,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                }}
              >
                {task.description}
              </p>
            )}
          </div>
        </div>

        <Badge
          bg={sm.bg}
          fg={sm.fg}
        >
          {sm.label}
        </Badge>
      </div>

      {/* Assignment information */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(145px, 1fr))',
          gap: 8,
          marginTop: 14,
        }}
      >
        <Info
          icon="RefreshCw"
          label="Schedule"
          value={recurrence}
          textColor={text}
          mutedColor={muted}
          borderColor={border}
          background={
            theme?.inputBg ||
            theme?.cardBg ||
            '#f8fafc'
          }
        />

        <Info
          icon="Activity"
          label="Time"
          value={task.start_time && task.deadline_time ? `${formatTime(task.start_time)} – ${formatTime(task.deadline_time)}` : formatTime(task.deadline_time || task.scheduled_time)}
          textColor={text}
          mutedColor={muted}
          borderColor={border}
          background={
            theme?.inputBg ||
            theme?.cardBg ||
            '#f8fafc'
          }
        />

        <Info
          icon="FileText"
          label="Date"
          value={formatDate(
            task.scheduled_date
          )}
          textColor={text}
          mutedColor={muted}
          borderColor={border}
          background={
            theme?.inputBg ||
            theme?.cardBg ||
            '#f8fafc'
          }
        />

        <Info
          icon="Shield"
          label="Limit"
          value={`${safeTimeLimit} min`}
          textColor={text}
          mutedColor={muted}
          borderColor={border}
          background={
            theme?.inputBg ||
            theme?.cardBg ||
            '#f8fafc'
          }
        />

        {managerName && (
          <Info
            icon="User"
            label="Assigned users"
            value={managerName}
            textColor={text}
            mutedColor={muted}
            borderColor={border}
            background={
              theme?.inputBg ||
              theme?.cardBg ||
              '#f8fafc'
            }
          />
        )}

        {branchName && (
          <Info
            icon="MapPin"
            label="Branch"
            value={branchName}
            textColor={text}
            mutedColor={muted}
            borderColor={border}
            background={
              theme?.inputBg ||
              theme?.cardBg ||
              '#f8fafc'
            }
          />
        )}
      </div>

      {/* Completion information */}
      {completed &&
        completion?.completed_at && (
          <div
            style={{
              marginTop: 11,
              padding: '9px 11px',
              borderRadius: 9,
              background:
                theme?.inputBg ||
                '#f8fafc',
              color: muted,
              fontSize: 12,
            }}
          >
            Checked at{' '}
            {new Date(
              completion.completed_at
            ).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}

            {completion.note
              ? ` · ${completion.note}`
              : ''}
          </div>
        )}

      {/* Actions */}
      {showActions && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop:
              '1px solid #f0f2f5',
          }}
        >
          {onComplete && !completed && (
            <button
              type="button"
              onClick={() =>
                onComplete(task)
              }
              style={{
                border: 0,
                borderRadius: 9,
                padding: '8px 12px',
                background: '#16a34a',
                color: '#fff',
                fontSize: 12,
                fontWeight: 750,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ic
                n="CheckCircle"
                size={15}
              />

              Mark checked
            </button>
          )}

          {onView && (
            <Btn
              variant="outline"
              onClick={() =>
                onView(task)
              }
            >
              <Ic
                n="Eye"
                size={15}
              />

              View
            </Btn>
          )}

          {onEdit && (
            <Btn
              variant="outline"
              onClick={() =>
                onEdit(task)
              }
            >
              <Ic
                n="Edit"
                size={15}
              />

              Edit
            </Btn>
          )}

          {onDelete && (
            <Btn
              variant="danger"
              onClick={() =>
                onDelete(task)
              }
            >
              <Ic
                n="Trash2"
                size={15}
              />

              Delete
            </Btn>
          )}
        </div>
      )}
    </div>
  )
}

function Info({
  icon,
  label,
  value,
  textColor = '#101828',
  mutedColor = '#98a2b3',
  background = '#f8fafc',
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '8px 9px',
        borderRadius: 9,
        background,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: mutedColor,
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        <Ic
          n={icon}
          size={12}
        />

        {label}
      </div>

      <div
        style={{
          marginTop: 3,
          color: textColor,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function Badge({
  children,
  bg,
  fg,
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 10.5,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  )
}

