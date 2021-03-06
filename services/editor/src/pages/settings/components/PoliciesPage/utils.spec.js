/* global jest, beforeEach, describe, it, afterEach, expect Promise process */

import {act} from 'react-dom/test-utils';
import { renderHook } from '@testing-library/react-hooks';
import { useRemoteState } from './utils';

describe('useRemoteState', () => {
  it('should load data', async () => {
    let data, setData, remote;
    const mockLoad = jest.fn(() => Promise.resolve({ test: 'abc' }));

    const {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, jest.fn());
    });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect((remote.loadingState = 'loading'));
    await waitForNextUpdate();
    expect(data).toEqual({ test: 'abc' });
    expect((remote.loadingState = 'idle'));
    expect(true).toEqual(true);
  });

  it('should identified dirty state', async () => {
    let data, setData, remote;
    const mockLoad = jest.fn(() => Promise.resolve('abc'));

    const {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, jest.fn());
    });
    await waitForNextUpdate();
    expect(remote.isDirty).toEqual(false);
    act(() => {
      setData('abc1');
    });
    expect(remote.isDirty).toEqual(true);
    act(() => {
      setData('abc');
    });
    expect(remote.isDirty).toEqual(false);
  });

  it('should save state', async () => {
    let data, setData, remote;
    let remoteData = 'abc';
    const mockLoad = jest.fn(() => {
      console.log("loading@@@@@@@@@@!!!!");
      return Promise.resolve(remoteData)
    });
    const mockSave = jest.fn(async (newData) => (remoteData = newData));

    let {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, mockSave);
    });

    expect(remote.loadingState).toEqual('loading');
    await waitForNextUpdate();
    act(() => {
      setData('abc1');
    });
    act(() => {
      remote.save();
    });

    expect(remote.loadingState).toEqual('saving');
    await waitForNextUpdate();
    expect(remote.loadingState).toEqual('idle');

    
    let {waitForNextUpdate: waitAfter} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, mockSave);
    });
    
    expect(remote.loadingState).toEqual('loading');
    await waitAfter();
    expect(remote.loadingState).toEqual('idle');
    expect(data).toEqual('abc1');
  });

  it("save should be no-op if data hasn't changed", async () => {
    let data, setData, remote;
    const mockLoad = jest.fn(() => Promise.resolve('abc'));
    const mockSave = jest.fn();

    const {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, mockSave);
    });

    await waitForNextUpdate();
    act(() => {
      setData('abc1');
    });
    act(() => {
      setData('abc');
    });
    act(() => {
      remote.save();
    });

    expect(remote.loadingState).toEqual('idle');
    expect(mockSave).toHaveBeenCalledTimes(0);
  });

  it('it should set state to error if failed to load', async () => {
    let data, setData, remote;
    const mockLoad = jest.fn(() => Promise.reject(new Error('some error')));

    const {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, jest.fn());
    });
    expect((remote.loadingState = 'loading'));
    await waitForNextUpdate();
    expect((remote.loadingState = 'error'));
    expect(remote.error.message).toEqual('some error');
  });

  it('if failed to save, it should set state to idle, project error value and allow to retry', async () => {
    let data, setData, remote;
    let tries = 0;
    let remoteData = 'abc';
    const mockLoad = jest.fn(() => Promise.resolve(remoteData));
    const mockSave = jest.fn((newData) =>
      tries++ == 0 ? Promise.reject(new Error('failed to save')) : (remoteData = newData),
    );

    const {waitForNextUpdate} = renderHook(() => {
      [data, setData, remote] = useRemoteState(mockLoad, mockSave);
    });

    await waitForNextUpdate();

    act(() => {
      setData('abc1');
    });
    act(() => {
      remote.save();
    });

    expect(remote.loadingState).toEqual('saving');
    await waitForNextUpdate();
    expect(remote.loadingState).toEqual('idle');
    expect(remoteData).toEqual('abc');
    expect(remote.error.message).toEqual('failed to save');

    act(() => {
      remote.save();
    });

    expect(remote.loadingState).toEqual('saving');
    await waitForNextUpdate();
    expect(remote.loadingState).toEqual('idle');
    expect(remoteData).toEqual('abc1');
    expect(remote.error).toEqual(undefined);
  });
});
