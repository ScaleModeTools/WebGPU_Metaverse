export class FakeMetaverseRenderer {
  compileAsyncCalls = [];
  disposed = false;
  info = {
    render: {
      drawCalls: 7,
      triangles: 1440
    }
  };
  initCalls = 0;
  lastCamera = null;
  lastScene = null;
  pixelRatio = null;
  renderCalls = 0;
  sizes = [];

  async compileAsync(scene, camera) {
    this.compileAsyncCalls.push({
      camera,
      scene
    });
  }

  async init() {
    this.initCalls += 1;
  }

  render(scene, camera) {
    this.lastCamera = camera;
    this.lastScene = scene;
    this.renderCalls += 1;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = pixelRatio;
  }

  setSize(width, height) {
    this.sizes.push([width, height]);
  }

  dispose() {
    this.disposed = true;
  }
}

export const disabledRuntimeCameraPhaseConfig = Object.freeze({
  entryPreview: Object.freeze({
    enabled: false,
    framingPadding: 1,
    minDistanceMeters: 0,
    minHeightMeters: 0,
    minimumDwellMs: 0,
    pitchRadians: -0.72
  })
});
