import { Button, Message, Collapse, Tag } from '@arco-design/web-react';
import React, { useState } from 'react';
import StepsWrapper from '@/renderer/components/base/StepsWrapper';
import ModalWrapper from '@/renderer/components/base/ModalWrapper';
import { Check } from '@icon-park/react';

const ComponentsShowcase: React.FC = () => {
  const [message, contextHolder] = Message.useMessage();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className='p-8 space-y-8 max-w-6xl mx-auto'>
      {contextHolder}

      <div>
        <h1 className='text-3xl font-bold mb-2'>AionUi Custom Component Showcase</h1>
        <p className='text-t-secondary'>Demonstrates all components customized in arco-override.css</p>
      </div>

      {/* Message */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Message - Notifications</h2>
        <div className='space-y-3'>
          <Button type='primary' status='success' onClick={() => message.success('Operation succeeded')} size='large'>
            Success Message
          </Button>
          <Button type='primary' status='warning' onClick={() => message.warning('Warning notice')} size='large'>
            Warning Message
          </Button>
          <Button type='primary' onClick={() => message.info('Informational notice')} size='large'>
            Info Message
          </Button>
          <Button type='primary' status='danger' onClick={() => message.error('Error notice')} size='large'>
            Error Message
          </Button>
          <Button
            onClick={() => {
              message.success('Operation succeeded');
              setTimeout(() => message.warning('Warning notice'), 200);
              setTimeout(() => message.info('Informational notice'), 400);
              setTimeout(() => message.error('Error notice'), 600);
            }}
            size='large'
          >
            Show all types
          </Button>
        </div>
      </section>

      {/* Button */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Button</h2>
        <div className='flex gap-3'>
          <Button type='outline'>Outline Button</Button>
          <Button type='primary'>Primary Button</Button>
          <Button>Default Button</Button>
          <Button type='primary' shape='round'>
            Round Button
          </Button>
        </div>
      </section>

      {/* Collapse */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Collapse</h2>
        <Collapse defaultActiveKey={['1']}>
          <Collapse.Item header='Collapse panel title 1' name='1'>
            <div>This is the content area of the collapse panel; any content can be placed here.</div>
          </Collapse.Item>
          <Collapse.Item header='Collapse panel title 2' name='2'>
            <div>Custom style: borderless, 8px rounded corners.</div>
          </Collapse.Item>
        </Collapse>
      </section>

      {/* Tag */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Tag (dark-mode optimized)</h2>
        <div className='flex gap-2 flex-wrap'>
          <Tag checkable color='blue'>
            Blue Tag
          </Tag>
          <Tag checkable color='green'>
            Green Tag
          </Tag>
          <Tag checkable color='red'>
            Red Tag
          </Tag>
          <Tag checkable color='orange'>
            Orange Tag
          </Tag>
          <Tag checkable color='gray'>
            Gray Tag
          </Tag>
        </div>
        <p className='text-sm text-t-secondary'>Tip: switch to dark mode to see the optimized styling.</p>
      </section>

      {/* Steps */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Steps</h2>
        <StepsWrapper current={currentStep} size='small'>
          <StepsWrapper.Step
            title='Step One'
            icon={currentStep > 1 ? <Check theme='filled' size={16} fill='#165dff' /> : undefined}
          />
          <StepsWrapper.Step
            title='Step Two'
            icon={currentStep > 2 ? <Check theme='filled' size={16} fill='#165dff' /> : undefined}
          />
          <StepsWrapper.Step title='Step Three' />
        </StepsWrapper>
        <div className='flex gap-2 mt-4'>
          <Button onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
            Previous
          </Button>
          <Button
            onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
            disabled={currentStep === 3}
            type='primary'
          >
            Next
          </Button>
        </div>
      </section>

      {/* Modal */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Modal</h2>
        <Button type='primary' onClick={() => setModalVisible(true)}>
          Open custom modal
        </Button>
        <ModalWrapper
          title='Custom Modal Title'
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={
            <div className='flex justify-end gap-3'>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button type='primary' onClick={() => setModalVisible(false)}>
                Confirm
              </Button>
            </div>
          }
        >
          <div className='p-6'>
            <p>This is a custom modal wrapped with ModalWrapper.</p>
            <p className='mt-2 text-t-secondary'>Features: 12px rounded corners, custom close button, theme background color.</p>
          </div>
        </ModalWrapper>
      </section>
    </div>
  );
};

export default ComponentsShowcase;
