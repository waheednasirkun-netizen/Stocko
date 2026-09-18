
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'Food Quality',
  'Food Safety',
  'Service',
  'Staff',
  'Cleanliness',
  'Delivery',
  'Billing',
  'Other',
]

const styles = {
  page: {
    minHeight: '100dvh',
    background:
      'radial-gradient(circle at top left, #eef2ff 0%, #f8fafc 38%, #f1f5f9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#111827',
    boxSizing: 'border-box',
  },

  card: {
    width: '100%',
    maxWidth: 520,
    background: '#ffffff',
    border: '1px solid rgba(226,232,240,.9)',
    borderRadius: 28,
    boxShadow: '0 25px 80px rgba(15,23,42,.12)',
    overflow: 'hidden',
  },

  header: {
    padding: '30px 24px 24px',
    textAlign: 'center',
    background:
      'linear-gradient(145deg, #312e81 0%, #4338ca 48%, #6366f1 100%)',
    color: '#ffffff',
    position: 'relative',
  },

  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.14)',
    border: '1px solid rgba(255,255,255,.2)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 15,
  },

  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.15,
    fontWeight: 850,
    letterSpacing: -0.7,
  },

  subtitle: {
    margin: '10px auto 0',
    maxWidth: 380,
    fontSize: 13,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,.82)',
  },

  branch: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 17,
    padding: '7px 11px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.12)',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },

  body: {
    padding: 24,
  },

  section: {
    marginBottom: 20,
  },

  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
    color: '#334155',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    border: '1px solid #dbe1ea',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    background: '#fff',
    color: '#111827',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    border: '1px solid #dbe1ea',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    background: '#fff',
    color: '#111827',
    resize: 'vertical',
    minHeight: 120,
    fontFamily: 'inherit',
  },
}

export default function ComplaintPublic({ token }) {
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const [form, setForm] = useState({
    order_reference: '',
    category: 'Other',
    description: '',
    rating: 5,
    customer_name: '',
    customer_phone: '',
  })

  useEffect(() => {
    let alive = true

    const loadQR = async () => {
      const { data, error: err } = await supabase.rpc(
        'get_complaint_qr',
        {
          p_token: token,
        }
      )

      if (!alive) return

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      const row = Array.isArray(data) ? data[0] : data

      if (!row) {
        setError('This feedback QR code is invalid or inactive.')
        setLoading(false)
        return
      }

      setQr(row)
      setLoading(false)

      if (row.qr_kind === 'delivery' && row.customer_name) {
        setForm((current) => ({
          ...current,
          customer_name: row.customer_name,
        }))
      }
    }

    loadQR()

    return () => {
      alive = false
    }
  }, [token])

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.rating) {
      setError('Please select a rating.')
      return
    }

    /*
     * For ratings below 3 we strongly encourage feedback text.
     * This gives the manager useful information about what went wrong.
     */
    if (Number(form.rating) < 3 && !form.description.trim()) {
      setError(
        'Please tell us what went wrong so we can improve your experience.'
      )
      return
    }

    setSubmitting(true)

    const { data, error: err } = await supabase.rpc(
      'submit_customer_complaint',
      {
        p_token: token,
        p_order_reference:
          form.order_reference.trim() || null,

        /*
         * This page always submits FEEDBACK.
         */
        p_entry_type: 'feedback',

        p_category: form.category,

        p_description:
          form.description.trim() ||
          `Customer submitted a ${form.rating}-star rating.`,

        p_rating: Number(form.rating),

        p_customer_name:
          form.customer_name.trim() || null,

        p_customer_phone:
          form.customer_phone.trim() || null,
      }
    )

    setSubmitting(false)

    if (err) {
      setError(err.message)
      return
    }

    if (!data?.success) {
      setError(
        data?.message ||
          'We could not submit your feedback. Please try again.'
      )
      return
    }

    setResult(data)
  }

  /*
   * Loading
   */
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div
            style={{
              padding: 55,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                border: '4px solid #e0e7ff',
                borderTopColor: '#4f46e5',
                margin: '0 auto 16px',
                animation: 'stockoSpin 1s linear infinite',
              }}
            />

            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#475569',
              }}
            >
              Preparing your feedback form…
            </div>

            <style>
              {`
                @keyframes stockoSpin {
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}
            </style>
          </div>
        </div>
      </div>
    )
  }

  /*
   * Invalid QR
   */
  if (error && !qr) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div
            style={{
              padding: 40,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                fontSize: 28,
              }}
            >
              ★
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 850,
                marginBottom: 8,
              }}
            >
              Stocko Feedback
            </div>

            <p
              style={{
                margin: 0,
                color: '#64748b',
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  /*
   * Success
   */
  if (result) {
    const rating = Number(form.rating)

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div
            style={{
              padding: '45px 25px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: '#ecfdf5',
                border: '8px solid #f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 36,
              }}
            >
              ✓
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 850,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                color: '#4f46e5',
                marginBottom: 8,
              }}
            >
              Feedback Received
            </div>

            <h1
              style={{
                margin: '0 0 10px',
                fontSize: 27,
                fontWeight: 850,
              }}
            >
              Thank you!
            </h1>

            <p
              style={{
                margin: '0 auto',
                maxWidth: 360,
                color: '#64748b',
                lineHeight: 1.65,
                fontSize: 14,
              }}
            >
              Your feedback has been received. Thank you for helping us
              improve your experience.
            </p>

            <div
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 18,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 700,
                  marginBottom: 7,
                }}
              >
                YOUR RATING
              </div>

              <div
                style={{
                  fontSize: 28,
                  letterSpacing: 2,
                }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    style={{
                      color:
                        n <= rating ? '#f59e0b' : '#cbd5e1',
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 25,
                fontSize: 11,
                color: '#94a3b8',
                fontWeight: 600,
              }}
            >
              Powered by Stocko
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isTable = qr?.qr_kind === 'table'
  const isLowRating = Number(form.rating) < 3

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* =====================================================
            BRAND HEADER
        ====================================================== */}
        <div style={styles.header}>
          <div style={styles.brandBadge}>
            STOCKO CUSTOMER CARE
          </div>

          <h1 style={styles.title}>
            How was your experience?
          </h1>

          <p style={styles.subtitle}>
            Your feedback helps us improve our food, service and
            customer experience.
          </p>

          <div style={styles.branch}>
            <span>📍</span>

            <span>
              {qr?.branch_name || 'Your Branch'}
            </span>

            {isTable && qr?.table_number && (
              <>
                <span style={{ opacity: 0.45 }}>•</span>
                <span>Table {qr.table_number}</span>
              </>
            )}
          </div>
        </div>

        {/* =====================================================
            FORM
        ====================================================== */}
        <div style={styles.body}>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 18,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={submit}>

            {/* =================================================
                RATING
            ================================================== */}
            <div style={styles.section}>
              <label style={styles.label}>
                YOUR RATING
              </label>

              <div
                style={{
                  background:
                    'linear-gradient(135deg,#f8fafc,#eef2ff)',
                  border: '1px solid #e2e8f0',
                  borderRadius: 20,
                  padding: '20px 14px 16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 3,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((n) => {
                    const selected = n <= form.rating

                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() =>
                          updateForm('rating', n)
                        }
                        aria-label={`${n} star rating`}
                        style={{
                          border: 0,
                          background: 'transparent',
                          fontSize: 40,
                          lineHeight: 1,
                          padding: '3px 5px',
                          cursor: 'pointer',
                          color: selected
                            ? '#f59e0b'
                            : '#cbd5e1',
                          transform: selected
                            ? 'scale(1.05)'
                            : 'scale(1)',
                          transition:
                            'all .15s ease',
                        }}
                      >
                        ★
                      </button>
                    )
                  })}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 800,
                    color:
                      form.rating < 3
                        ? '#dc2626'
                        : form.rating === 3
                        ? '#d97706'
                        : '#475569',
                  }}
                >
                  {form.rating === 1 &&
                    'Very dissatisfied'}
                  {form.rating === 2 &&
                    'Dissatisfied'}
                  {form.rating === 3 &&
                    'It was okay'}
                  {form.rating === 4 &&
                    'Good experience'}
                  {form.rating === 5 &&
                    'Excellent experience'}
                </div>
              </div>
            </div>

            {/* =================================================
                LOW RATING NOTICE
            ================================================== */}
            {isLowRating && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 13,
                  borderRadius: 13,
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                <strong>We’re sorry your experience wasn’t great.</strong>
                <br />
                Please tell us what happened so our team can look
                into it and improve.
              </div>
            )}

            {/* =================================================
                ORDER NUMBER
            ================================================== */}
            <div style={styles.section}>
              <label style={styles.label}>
                ORDER NUMBER {isTable ? '(OPTIONAL)' : ''}
              </label>

              <input
                value={form.order_reference}
                onChange={(e) =>
                  updateForm(
                    'order_reference',
                    e.target.value
                  )
                }
                placeholder="Enter your order / invoice number"
                style={styles.input}
              />

              {isTable && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: '#94a3b8',
                  }}
                >
                  Table {qr.table_number} was detected
                  automatically from this QR code.
                </div>
              )}
            </div>

            {/* =================================================
                CATEGORY
            ================================================== */}
            <div style={styles.section}>
              <label style={styles.label}>
                WHAT WOULD YOU LIKE TO TELL US ABOUT?
              </label>

              <select
                value={form.category}
                onChange={(e) =>
                  updateForm(
                    'category',
                    e.target.value
                  )
                }
                style={{
                  ...styles.input,
                  cursor: 'pointer',
                }}
              >
                {CATEGORIES.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* =================================================
                FEEDBACK
            ================================================== */}
            <div style={styles.section}>
              <label style={styles.label}>
                YOUR FEEDBACK{' '}
                {isLowRating ? '*' : '(OPTIONAL)'}
              </label>

              <textarea
                value={form.description}
                onChange={(e) =>
                  updateForm(
                    'description',
                    e.target.value
                  )
                }
                rows={5}
                placeholder={
                  isLowRating
                    ? 'Please tell us what went wrong…'
                    : 'Tell us about your experience…'
                }
                style={styles.textarea}
                required={isLowRating}
              />

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: '#94a3b8',
                }}
              >
                Your feedback helps our team improve.
              </div>
            </div>

            {/* =================================================
                CUSTOMER DETAILS
            ================================================== */}
            <div style={styles.section}>
              <label style={styles.label}>
                YOUR DETAILS{' '}
                <span
                  style={{
                    fontWeight: 500,
                    color: '#94a3b8',
                  }}
                >
                  (OPTIONAL)
                </span>
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: 10,
                }}
              >
                <input
                  value={form.customer_name}
                  onChange={(e) =>
                    updateForm(
                      'customer_name',
                      e.target.value
                    )
                  }
                  placeholder="Your name"
                  style={styles.input}
                />

                <input
                  value={form.customer_phone}
                  onChange={(e) =>
                    updateForm(
                      'customer_phone',
                      e.target.value
                    )
                  }
                  placeholder="Phone number"
                  style={styles.input}
                />
              </div>
            </div>

            {/* =================================================
                SUBMIT
            ================================================== */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '15px 18px',
                border: 0,
                borderRadius: 14,
                background:
                  submitting
                    ? '#818cf8'
                    : 'linear-gradient(135deg,#4338ca,#6366f1)',
                color: '#fff',
                fontWeight: 850,
                fontSize: 15,
                cursor: submitting
                  ? 'wait'
                  : 'pointer',
                boxShadow:
                  '0 10px 25px rgba(79,70,229,.25)',
                transition: 'all .2s ease',
              }}
            >
              {submitting
                ? 'Sending your feedback…'
                : 'Submit Feedback'}
            </button>
          </form>

          {/* =================================================
              FOOTER
          ================================================== */}
          <div
            style={{
              textAlign: 'center',
              marginTop: 18,
              fontSize: 10,
              color: '#94a3b8',
            }}
          >
            Your feedback is securely submitted to the
            restaurant.
            <div
              style={{
                marginTop: 5,
                fontWeight: 800,
                letterSpacing: 0.8,
              }}
            >
              POWERED BY STOCKO
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
