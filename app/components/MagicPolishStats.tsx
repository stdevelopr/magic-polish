import styles from './MagicPolishStats.module.css';

const stats = [
  { label: 'Next class', value: '17:30 · Today' },
  { label: 'Lesson theme', value: 'Warm greetings' }
];

export default function MagicPolishStats() {
  return (
    <section className={styles.stats} aria-label="Class overview">
      {stats.map((stat) => (
        <div className={styles.statCard} key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </div>
      ))}
    </section>
  );
}
