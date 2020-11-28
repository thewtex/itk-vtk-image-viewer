import { reaction, action } from 'mobx'

import updateSliceProperties from '../../Rendering/updateSliceProperties'
import updateVolumeProperties from '../../Rendering/updateVolumeProperties'
import style from '../ItkVtkViewer.module.css'

function createComponentSelector(store, imageUIGroup) {
  const viewerDOMId = store.id
  const eventEmitter = store.eventEmitter

  const componentSelector = document.createElement('div')
  componentSelector.setAttribute('class', style.selector)
  componentSelector.id = `${viewerDOMId}-componentSelector`

  const componentRow = document.createElement('div')
  componentRow.setAttribute('class', style.uiRow)
  // This row needs custom bottom padding, to aid in the illusion
  // that it's the tabbed portion of a tabbed pane
  componentRow.setAttribute('style', 'padding-bottom: 0px;')
  componentRow.className += ` ${viewerDOMId}-volumeComponents ${viewerDOMId}-collapsible`

  function updateAvailableComponents() {
    const components = store.imageUI.totalIntensityComponents
    if (components > 1 && store.imageUI.independentComponents) {
      componentRow.style.display = 'flex'
    } else {
      componentRow.style.display = 'none'
    }

    componentSelector.innerHTML = new Array(components)
      .fill(undefined)
      .map((_, ii) => ii)
      .map(
        (idx, component) =>
          `<input name="tabs" type="radio" id="tab-${component}" ${
            idx === 0 ? 'checked="checked"' : ''
          } class="${
            style.componentTab
          }" data-component-index="${component}"/><label for="tab-${component}" class="${
            style.compTabLabel
          }">&nbsp;${component}&nbsp;<input type="checkbox" ${
            store.imageUI.componentVisibilities[idx].visible
              ? 'checked="checked"'
              : ''
          } class="${
            style.componentVisibility
          }" data-component-index="${component}"\></label>`
      )
      .join('')
    componentSelector.value = 0
    store.imageUI.selectedComponent = 0
  }
  reaction(
    () => {
      return store.imageUI.fusedImageLabelMap
    },
    image => {
      updateAvailableComponents()
    }
  )
  updateAvailableComponents()

  function syncCheckState(visibilityList) {
    visibilityList.forEach((visibility, compIdx) => {
      const elt = componentSelector.querySelector(
        `input[data-component-index="${compIdx}"][type="checkbox"]`
      )
      elt.checked = visibility
    })
  }

  function setEnabled(isFusing) {
    componentSelector
      .querySelectorAll('input[type="checkbox"],label')
      .forEach(elt => {
        if (isFusing) {
          elt.classList.add(style.componentDisabled)
        } else {
          elt.classList.remove(style.componentDisabled)
        }
      })
  }

  store.eventEmitter.on('fusingStatusChanged', isFusing => {
    setEnabled(isFusing)
  })

  componentSelector.addEventListener(
    'change',
    action(event => {
      event.preventDefault()
      event.stopPropagation()
      const selIdx = Number(event.target.dataset.componentIndex)
      if (event.target.type === 'radio') {
        store.imageUI.selectedComponent = selIdx
      } else if (event.target.type === 'checkbox') {
        const visibility = event.target.checked
        const currentVisualizedIndexOfSelected = store.imageUI.visualizedComponents.indexOf(
          selIdx
        )
        let removed = -1
        if (visibility && currentVisualizedIndexOfSelected < 0) {
          // A component was made visible, and it was not already in the list
          // of visualized components
          if (
            store.imageUI.visualizedComponents.length >=
            store.imageUI.maxIntensityComponents
          ) {
            // Find the index in the visulized components list of the last touched
            // component.  We need to replace it with this component the user just
            // turned on.
            const currentVisualizedIndexOfLastTouched = store.imageUI.visualizedComponents.indexOf(
              store.imageUI.lastComponentVisibilityChanged
            )
            removed = currentVisualizedIndexOfLastTouched
            store.imageUI.componentVisibilities[removed].visible = false
          } else {
            store.imageUI.visualizedComponents.push(selIdx)
          }
        }

        store.imageUI.lastComponentVisibilityChanged = selIdx
        store.imageUI.componentVisibilities[selIdx].visible = visibility

        if (removed >= 0) {
          // We are going to trigger a re-computation of the fusedImageLabelMap,
          // so if we want the DOM to be able tor re-render to indicated we're
          // busy, we should emit that event immediately, and then asynchronously
          // change the property that will actually trigger the recomputation.
          store.eventEmitter.emit('fusingStatusChanged', true)
          setTimeout(() => {
            store.imageUI.visualizedComponents.splice(removed, 1, selIdx)
          }, 0)
        }
      }
    })
  )

  reaction(
    () => {
      return store.imageUI.componentVisibilities.map(
        compVis => `${compVis.visible},${compVis.weight}`
      )
    },
    visibilities => {
      syncCheckState(
        store.imageUI.componentVisibilities.map(compVis => compVis.visible)
      )
      updateSliceProperties(store)
      updateVolumeProperties(store)
      const renderWindow = store.renderWindow
      if (!renderWindow.getInteractor().isAnimating()) {
        renderWindow.render()
      }
    }
  )

  componentRow.appendChild(componentSelector)
  imageUIGroup.appendChild(componentRow)

  return componentSelector
}

export default createComponentSelector
