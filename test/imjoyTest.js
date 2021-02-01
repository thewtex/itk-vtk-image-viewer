import test from 'tape-catch'
import axios from 'axios'

import itkreadImageArrayBuffer from 'itk/readImageArrayBuffer'
import vtkITKHelper from 'vtk.js/Sources/Common/DataModel/ITKHelper'
import testUtils from 'vtk.js/Sources/Testing/testUtils'

import UserInterface from '../src/UserInterface'
import referenceUIMachineOptions from '../src/UI/Reference/referenceUIMachineOptions'

const testImage3DPath = 'base/test/data/input/HeadMRVolume.nrrd'
const testImage3DPath2 = 'base/test/data/input/mri3D.nrrd'

import createScreenshotButton from '../src/UI/Reference/Main/createScreenshotButton'
import createFullscreenButton from '../src/UI/Reference/Main/createFullscreenButton'
import createRotateButton from '../src/UI/Reference/Main/createRotateButton'
import createAnnotationsButton from '../src/UI/Reference/Main/createAnnotationsButton'
import createAxesButton from '../src/UI/Reference/Main/createAxesButton'
import createViewPlanesToggle from '../src/UI/Reference/Main/createViewPlanesToggle'
import createPlaneSliders from '../src/UI/Reference/Main/createPlaneSliders'
import createBackgroundColorButton from '../src/UI/Reference/Main/createBackgroundColorButton'
import createCroppingButtons from '../src/UI/Reference/Main/createCroppingButtons'
import createViewModeButtons from '../src/UI/Reference/Main/createViewModeButtons'
import createResetCameraButton from '../src/UI/Reference/Main/createResetCameraButton'

function modifiedCreateMainInterface(context) {
  const mainUIGroup = document.createElement('div')
  mainUIGroup.setAttribute('class', style.uiGroup)
  context.uiGroups.set('main', mainUIGroup)

  const mainUIRow1 = document.createElement('div')
  mainUIRow1.setAttribute('class', style.mainUIRow)
  mainUIGroup.appendChild(mainUIRow1)

  createScreenshotButton(context, mainUIRow1)
  // Leave out the fullscreen button
  //createFullscreenButton(context, mainUIRow1)
  //if (!context.use2D) {
  //createRotateButton(context, mainUIRow1)
  //}
  //createAnnotationsButton(context, mainUIRow1)
  createAxesButton(context, mainUIRow1)
  createViewPlanesToggle(context, mainUIRow1)
  // Leave out the plane sliders
  // createPlaneSliders(context)

  createBackgroundColorButton(context, mainUIRow1)
  const mainUIRow2 = document.createElement('div')
  mainUIRow2.setAttribute('class', style.mainUIRow)

  if (context.use2D) {
    createCroppingButtons(context, mainUIRow1)
    createViewModeButtons(context, mainUIRow2)
    createResetCameraButton(context, mainUIRow1)
  } else {
    createCroppingButtons(context, mainUIRow2)
    createViewModeButtons(context, mainUIRow2)
    createResetCameraButton(context, mainUIRow2)
    mainUIGroup.appendChild(mainUIRow2)
  }

  context.uiContainer.appendChild(mainUIGroup)
}

import * as imjoyCore from 'imjoy-core'
import ndarray from 'ndarray'

const TEST_STYLE_RENDERING_VIEW_CONTAINER = {
  position: 'relative',
  width: '600px',
  height: '600px',
  minHeight: '600px',
  minWidth: '600px',
  maxHeight: '600px',
  maxWidth: '600px',
  margin: '0',
  padding: '0',
  top: '0',
  left: '0',
  overflow: 'hidden',
}
const TEST_VIEWER_STYLE = {
  backgroundColor: [1, 1, 1],
  containerStyle: TEST_STYLE_RENDERING_VIEW_CONTAINER,
}
function applyStyle(el, style) {
  Object.keys(style).forEach(key => {
    el.style[key] = style[key]
  })
}
function encodeArray(array) {
  return {
    _rtype: 'ndarray',
    _rdtype: array.dtype,
    _rshape: array.shape,
    _rvalue: array.data.buffer,
  }
}

const testConfig = JSON.parse(
  '{"viewerConfigVersion":"1.0","renderingViewContainerStyle":{"position":"relative","width":"600px","height":"600px","minHeight":"600px","minWidth":"600px","maxHeight":"600px","maxWidth":"600px","margin":"0","padding":"0","top":"0","left":"0","overflow":"hidden"},"main":{"backgroundColor":[0.7,0.2,0.8],"units":"mm"}}'
)

test('Test ImJoy Plugin', async t => {
  t.plan(6)
  const gc = testUtils.createGarbageCollector(t)

  const container = document.querySelector('body')
  const viewerContainer = gc.registerDOMElement(document.createElement('div'))
  container.appendChild(viewerContainer)

  const response = await axios.get(testImage3DPath, {
    responseType: 'arraybuffer',
  })
  const { image: itkImage, webWorker } = await itkreadImageArrayBuffer(
    null,
    response.data,
    'data.nrrd'
  )
  webWorker.terminate()
  const array = ndarray(itkImage.data, itkImage.size.slice().reverse())

  const uiMachineOptions = { ...referenceUIMachineOptions }
  function testCreateMainInterface(context) {
    t.pass('Modified ui createMainInterface')
    modifiedCreateMainInterface(context)
  }
  const testUIMainActions = { ...uiMachineOptions.main.actions }
  testUIMainActions.createMainInterface = testCreateMainInterface
  const testUIMain = { ...uiMachineOptions.main }
  testUIMain.actions = testUIMainActions
  uiMachineOptions.main = testUIMain

  const imjoy_api = {
    showMessage(plugin, info, duration) {
      console.log(info)
    },
  }
  const imjoy = new imjoyCore.ImJoy({
    imjoy_api,
  })
  imjoy.event_bus.on('show_message', console.log)
  imjoy.event_bus.on('add_window', async w => {
    viewerContainer.id = w.window_id
    applyStyle(viewerContainer, TEST_STYLE_RENDERING_VIEW_CONTAINER)
  })
  await imjoy.start({ workspace: 'default' })
  console.log('ImJoy started')

  const viewer = await imjoy.pm.createWindow(null, {
    src: 'http://localhost:9876/base/dist/index.html',
    data: { image: itkImage },
    // Stalls
    //uiMachineOptions },
    config: testConfig,
  })
  await viewer.setImage(encodeArray(array))
  t.pass('setImage ndarray')

  const bgColor = [0.2, 0.8, 0.7]
  await viewer.setBackgroundColor(bgColor)
  const resultBGColor = await viewer.getBackgroundColor()
  t.same(bgColor, resultBGColor, 'background color')

  await viewer.setImage(itkImage)
  t.pass('setImage itk.js Image')

  const imageURL = new URL(testImage3DPath, document.location.origin)
  await viewer.setImage(imageURL)
  t.pass('setImage URL')

  //imjoy.destroy()
  console.log('ImJoy destroyed')

  t.pass('test completed')
  //gc.releaseResources()
})
