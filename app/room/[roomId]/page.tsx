import RoomView from './RoomView';

type RoomPageProps = {
  params: { roomId: string };
};

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <main className="container">
      <RoomView roomId={params.roomId} />
    </main>
  );
}
