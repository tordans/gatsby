import { createMachine, StatesConfig, MachineOptions } from "xstate"
import { dataLayerActions } from "./actions"
import { IDataLayerContext } from "./types"
import { dataLayerServices } from "./services"

export type DataLayerResult = Pick<
  IDataLayerContext,
  | "gatsbyNodeGraphQLFunction"
  | "graphqlRunner"
  | "pagesToBuild"
  | "pagesToDelete"
>

const loadDataStates: StatesConfig<IDataLayerContext, any, any> = {
  customizingSchema: {
    invoke: {
      src: `customizeSchema`,
      id: `customizing-schema`,
      onDone: {
        target: `sourcingNodes`,
      },
    },
  },
  sourcingNodes: {
    invoke: {
      src: `sourceNodes`,
      id: `sourcing-nodes`,
      onDone: {
        target: `buildingSchema`,
        actions: `assignChangedPages`,
      },
    },
  },
}

const initialCreatePagesStates: StatesConfig<IDataLayerContext, any, any> = {
  buildingSchema: {
    invoke: {
      id: `building-schema`,
      src: `buildSchema`,
      onDone: {
        target: `creatingPages`,
        actions: `assignGraphQLRunners`,
      },
    },
  },
  creatingPages: {
    invoke: {
      id: `creating-pages`,
      src: `createPages`,
      onDone: {
        target: `writingOutRedirects`,
        actions: `assignChangedPages`,
      },
    },
  },
  writingOutRedirects: {
    invoke: {
      src: `writeOutRedirectsAndWatch`,
      onDone: {
        target: `done`,
      },
    },
  },
}

const recreatePagesStates: StatesConfig<IDataLayerContext, any, any> = {
  buildingSchema: {
    invoke: {
      id: `building-schema`,
      src: `buildSchema`,
      onDone: [
        {
          target: `graphQLTypegen`,
          cond: (): boolean => !!process.env.GATSBY_GRAPHQL_TYPEGEN,
        },
        {
          target: `creatingPages`,
        },
      ],
    },
    exit: `assignGraphQLRunners`,
  },
  graphQLTypegen: {
    invoke: {
      src: {
        type: `graphQLTypegen`,
        compile: `schema`,
      },
      onDone: {
        target: `creatingPages`,
      },
    },
  },
  creatingPages: {
    invoke: {
      id: `creating-pages`,
      src: `createPages`,
      onDone: {
        target: `done`,
        actions: `assignChangedPages`,
      },
    },
  },
}

const doneState: StatesConfig<IDataLayerContext, any, any> = {
  done: {
    type: `final`,
    data: ({
      gatsbyNodeGraphQLFunction,
      graphqlRunner,
      pagesToBuild,
      pagesToDelete,
    }): DataLayerResult => {
      return {
        gatsbyNodeGraphQLFunction,
        graphqlRunner,
        pagesToBuild,
        pagesToDelete,
      }
    },
  },
}

const options: Partial<MachineOptions<IDataLayerContext, any>> = {
  actions: dataLayerActions,
  services: dataLayerServices,
}

/**
 * Machine used during first run
 */

export const initializeDataMachine = createMachine(
  {
    id: `initializeDataMachine`,
    context: {},
    initial: `customizingSchema`,
    states: {
      ...loadDataStates,
      ...initialCreatePagesStates,
      ...doneState,
    },
  },
  options
)

/**
 * Machine used when we need to source nodes again
 */

export const reloadDataMachine = createMachine(
  {
    id: `reloadDataMachine`,
    context: {},
    initial: `customizingSchema`,
    states: {
      ...loadDataStates,
      ...recreatePagesStates,
      ...doneState,
    },
  },
  options
)

/**
 * Machine used when we need to re-create pages after a
 * node mutation outside of sourceNodes
 */
export const recreatePagesMachine = createMachine(
  {
    id: `recreatePagesMachine`,
    context: {},
    initial: `buildingSchema`,
    states: {
      ...recreatePagesStates,
      ...doneState,
    },
  },
  options
)
