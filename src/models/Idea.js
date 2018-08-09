// @flow
type IdeaProps = {
  id: string,
  boardId: string,
  name: string,
  description: ?string,
  ease: number,
  confidence: number,
  impact: number,
}
export class Idea {
  id: string
  boardId: string
  name: string
  description: ?string
  ease: number
  confidence: number
  impact: number

  constructor(props: IdeaProps) {
    this.id = props.id
    this.boardId = props.boardId
    this.name = props.name
    this.description = props.description || null
    this.ease = props.ease
    this.confidence = props.confidence
    this.impact = props.impact
  }

  getAverage(): number {
    return (this.ease + this.confidence + this.impact) / 3
  }

  toExport() {
    const obj = { ...this }
    // Remove private fields
    delete obj.id
    delete obj.boardId
    return obj
  }
}