import Phaser from 'phaser';
import { COLORS } from '../config/palette.js';
import { TouchButton } from './TouchButton.js';

/**
 * Right hand cluster of attack buttons for touch devices:
 * block (hold), punch, headbutt and stomp.
 */
export class ActionButtons extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const { x = 0, y = 0, alpha = 0.95, onAction = null } = config;

    super(scene, x, y);
    this.setAlpha(alpha);
    this.onAction = onAction;

    const emit = (action, isDown) => this.onAction?.(action, isDown);

    this.buttons = [
      new TouchButton(scene, {
        x: -372,
        y: 24,
        radius: 62,
        label: 'BLOCK',
        subLabel: 'hold',
        color: COLORS.blue,
        holdable: true,
        onPress: () => emit('block', true),
        onRelease: () => emit('block', false),
      }),
      new TouchButton(scene, {
        x: -234,
        y: -66,
        radius: 66,
        label: 'PUNCH',
        subLabel: 'light',
        color: COLORS.gold,
        onPress: () => emit('punch', true),
      }),
      new TouchButton(scene, {
        x: -96,
        y: 24,
        radius: 66,
        label: 'HEAD',
        subLabel: 'medium',
        color: COLORS.purple,
        onPress: () => emit('headbutt', true),
      }),
      new TouchButton(scene, {
        x: 62,
        y: -66,
        radius: 80,
        label: 'STOMP',
        subLabel: 'heavy',
        color: COLORS.red,
        fontSize: 28,
        onPress: () => emit('stomp', true),
      }),
    ];

    this.add(this.buttons);
    scene.add.existing(this);
  }

  releaseAll() {
    this.buttons.forEach((button) => {
      if (button.isDown && button.holdable) button.zone.emit('pointerup');
    });
  }
}
