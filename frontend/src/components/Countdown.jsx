import { useState, useEffect } from 'react'

function calcTimeLeft(endTime) {
  const diff = new Date(endTime) - new Date()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

export default function Countdown({ endTime, compact = false, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(endTime))

  useEffect(() => {
    if (!timeLeft) return
    const timer = setInterval(() => {
      const tl = calcTimeLeft(endTime)
      setTimeLeft(tl)
      if (!tl && onExpire) onExpire()
    }, 1000)
    return () => clearInterval(timer)
  }, [endTime, onExpire])

  if (!timeLeft) {
    return <span className="badge badge-sold">Auction Ended</span>
  }

  if (compact) {
    return (
      <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
        {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    )
  }

  return (
    <div className="countdown">
      {timeLeft.days > 0 && (
        <>
          <div className="countdown-unit">
            <div className="countdown-num">{String(timeLeft.days).padStart(2,'0')}</div>
            <div className="countdown-label">days</div>
          </div>
          <div className="countdown-sep">:</div>
        </>
      )}
      <div className="countdown-unit">
        <div className="countdown-num">{String(timeLeft.hours).padStart(2,'0')}</div>
        <div className="countdown-label">hrs</div>
      </div>
      <div className="countdown-sep">:</div>
      <div className="countdown-unit">
        <div className="countdown-num">{String(timeLeft.minutes).padStart(2,'0')}</div>
        <div className="countdown-label">min</div>
      </div>
      <div className="countdown-sep">:</div>
      <div className="countdown-unit">
        <div className="countdown-num">{String(timeLeft.seconds).padStart(2,'0')}</div>
        <div className="countdown-label">sec</div>
      </div>
    </div>
  )
}
