import RoomView from './RoomView';
import styles from './RoomView.module.css';

type RoomPageProps = {
  params: { roomId: string };
};

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <main className={styles.roomPage}>
      <RoomView roomId={params.roomId} />
    </main>
  );
}
