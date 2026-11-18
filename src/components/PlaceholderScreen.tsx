interface PlaceholderScreenProps {
  title: string
  description: string
}

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <section className="placeholder-screen">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}
