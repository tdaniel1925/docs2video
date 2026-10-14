import QuestionList from '../../_components/answers-reviews/QuestionList'
import s from '../../_components/answers-reviews/ar.module.css'

/* CLIENT QUESTIONS — everything clients asked under your videos, newest
   first. Each one opens the reply screen (/questions/[id]). */
export default function QuestionsPage() {
  return (
    <div className={s.page}>
      <h1 className={s.title}>Client questions</h1>
      <p className={s.lead}>
        What clients asked under your videos. We draft an answer from their own document and show you where it came from.
        Nothing is sent until you approve it.
      </p>
      <QuestionList />
    </div>
  )
}
