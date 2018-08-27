// @flow
import * as React from "react"
import { db } from "../facades/FirebaseFacade"
import { Board } from "../models/Board"
import { FieldPath } from "../helpers/firebaseUtils"
import * as Rx from "rxjs/Rx"
import { BOARD_ROLES, COLLECTIONS } from "../constants/firebase"
import { type RouterHistory } from "react-router-dom"
import { AuthFacade } from "../facades/AuthFacade"
import { BoardsFacade } from "../facades/BoardsFacade"

const BoardsContext = React.createContext()

type BoardsProviderProps = {
  children: ?React.Node,
}

type BoardsProviderState = {
  boards: ?Array<Board>,
  currentBoard: ?Board,
}

class BoardsProvider extends React.PureComponent<
  BoardsProviderProps,
  BoardsProviderState
> {
  static defaultProps = {}

  state = {
    boards: null,
    currentBoard: null,
  }

  unsubscribeFunctions: Array<Function> = []

  componentDidMount() {
    this.subscribe()
    AuthFacade.onAuthStateChanged(this.subscribe)
  }

  componentWillUnmount() {
    this.unsubscribe()
  }

  subscribe = () => {
    const user = AuthFacade.getCurrentUser()
    if (!user) {
      return
    }
    this.unsubscribe()
    const collection = db.collection(COLLECTIONS.BOARDS)
    const userId = user.id
    const emailPath = new FieldPath("roles", user.email)
    const ownedRef = collection.where("ownerId", "==", userId)
    const adminRef = collection.where(emailPath, "==", BOARD_ROLES.ADMIN)
    const editorRef = collection.where(emailPath, "==", BOARD_ROLES.EDITOR)
    const readerRef = collection.where(emailPath, "==", BOARD_ROLES.READER)

    // Create Observables.
    const owned$ = new Rx.Subject()
    const admin$ = new Rx.Subject()
    const editor$ = new Rx.Subject()
    const reader$ = new Rx.Subject()

    this.unsubscribeFunctions.push(this.observeBoardQuery(ownedRef, owned$))
    this.unsubscribeFunctions.push(this.observeBoardQuery(adminRef, admin$))
    this.unsubscribeFunctions.push(this.observeBoardQuery(editorRef, editor$))
    this.unsubscribeFunctions.push(this.observeBoardQuery(readerRef, reader$))

    Rx.Observable.combineLatest(owned$, admin$, editor$, reader$).subscribe(
      (boardsContainers: Array<Array<Board>>) => {
        console.log("Boards updated")
        const boards: Array<Board> = [].concat.apply([], [...boardsContainers])
        const currentBoard = this.state.currentBoard
          ? boards.find(
              (board: Board) =>
                this.state.currentBoard &&
                this.state.currentBoard.id === board.id
            )
          : boards[0]
        this.setState({ boards, currentBoard })
      }
    )
  }

  unsubscribe = () => {
    this.unsubscribeFunctions.forEach((unsubscribeFn: Function) => {
      unsubscribeFn()
    })
  }

  observeBoardQuery = (
    queryRef: $npm$firebase$firestore$Query,
    rxSubject$: rxjs$Observer<Array<Board>>
  ): Function =>
    queryRef.onSnapshot((querySnapshot) => {
      const boards = querySnapshot.docs.map(
        (doc) =>
          new Board({
            id: doc.id,
            ...doc.data(),
          })
      )
      rxSubject$.next(boards)
    })

  setActiveBoard = (boardId: ?string): void => {
    const boards = this.state.boards
    if (!boards || !boardId) {
      return this.setState({ currentBoard: null })
    }
    const foundBoards: Array<Board> = boards.filter(
      (board: Board) => board.id === boardId
    )
    if (!foundBoards.length) {
      throw new Error("No board found with given boardId")
    }
    const currentBoard = foundBoards[0]
    this.setState({ currentBoard })
  }

  deleteActiveBoard = (): Promise<mixed> => {
    const { boards, currentBoard } = this.state
    if (!currentBoard) {
      throw new Error("No active board")
    }
    return BoardsFacade.deleteBoard(currentBoard.id).then(() => {
      if (boards && boards.length > 1) {
        const firstBoard = boards.find(
          (board: Board) => board.id !== currentBoard.id
        )
        if (firstBoard) {
          this.setActiveBoard(firstBoard.id)
        }
      } else {
        this.setActiveBoard(null)
      }
    })
  }

  render() {
    const boardStore: BoardsStoreType = {
      ...this.state,
      setActiveBoard: this.setActiveBoard,
      deleteActiveBoard: this.deleteActiveBoard,
    }
    return (
      <BoardsContext.Provider value={boardStore}>
        {this.props.children}
      </BoardsContext.Provider>
    )
  }
}

export type BoardsStoreType = {
  boards: ?Array<Board>,
  currentBoard: ?Board,
  setActiveBoard: (string) => void,
  deleteActiveBoard: () => Promise<mixed>,
}

export { BoardsProvider, BoardsContext }
