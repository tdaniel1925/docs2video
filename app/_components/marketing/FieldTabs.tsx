'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

/*
 * "Built for your field": one tab per field, each with the document it starts
 * from, the problem, what the video does and a real-looking scene. Every field
 * here has its own /for/* page; the pictures are made-up people (no real
 * carrier, firm or client).
 */
export type Field = {
  name: string
  kicker: string
  title: string
  doc: string
  reader: string
  problem: string
  does: string[]
  img: string
  alt: string
  caption: string
  href: string
}

export default function FieldTabs({ fields }: { fields: Field[] }) {
  const [picked, setPicked] = useState(0)
  const f = fields[picked]

  return (
    <>
      <div role="tablist" aria-label="Fields" className="hp-tabs">
        {fields.map((x, i) => (
          <button
            key={x.name}
            type="button"
            role="tab"
            id={`hp-tab-${i}`}
            aria-selected={i === picked}
            aria-controls="hp-field-panel"
            className={i === picked ? 'hp-tab hp-tab-on' : 'hp-tab'}
            onClick={() => setPicked(i)}
          >
            {x.name}
          </button>
        ))}
      </div>
      <div id="hp-field-panel" role="tabpanel" aria-labelledby={`hp-tab-${picked}`} className="hp-field">
        <div className="hp-field-copy">
          <span className="hp-kicker hp-kicker-blue">{f.kicker}</span>
          <b className="hp-field-title">{f.title}</b>
          <div className="hp-field-pills">
            <span><span>From </span><b>{f.doc}</b></span>
            <span><span>For your </span><b>{f.reader}</b></span>
          </div>
          <div className="hp-card">
            <b className="hp-caps">The problem</b>
            <p>{f.problem}</p>
          </div>
          <div className="hp-card hp-card-list">
            <b className="hp-caps">What the video does</b>
            {f.does.map((d) => <span key={d}><span className="hp-check" aria-hidden="true">✓ </span>{d}</span>)}
          </div>
          <p className="hp-field-more">
            Also for consulting, coaching, fitness, non-profits and property management.<br />
            <Link href={f.href}>More for {f.name.toLowerCase()} →</Link>
          </p>
        </div>
        <div className="hp-field-art">
          <Image src={f.img} alt={f.alt} fill sizes="(max-width: 1000px) calc(100vw - 32px), 600px" />
          <span className="hp-field-cap">{f.caption}</span>
        </div>
      </div>
    </>
  )
}
