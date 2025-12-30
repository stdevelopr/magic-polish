import RoomView from "./roomView/roomView.component";
import styles from "./page.module.css";

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
