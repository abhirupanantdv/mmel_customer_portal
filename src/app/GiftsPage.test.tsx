// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { GiftsPage } from './GiftsPage'

beforeAll(() => {
  window.scrollTo = vi.fn()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('GiftsPage', () => {
  it('browses products and completes the sample checkout', () => {
    render(<GiftsPage />)

    expect(screen.getByRole('heading', { name: 'Gift Your Loved Ones' })).toBeTruthy()
    expect(screen.getByText('Island Bloom Bouquet')).toBeTruthy()
    expect(screen.getByText('Pacific Gourmet Hamper')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Review bag/ }))

    fireEvent.change(screen.getByLabelText("Loved one's name"), { target: { value: 'Mere' } })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'A friend' } })
    fireEvent.change(screen.getByLabelText('Recipient mobile number'), { target: { value: '+679 700 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: 'Sample delivery address, Suva' } })
    fireEvent.change(screen.getByLabelText('Preferred delivery date'), { target: { value: '2026-11-05' } })
    fireEvent.click(screen.getByRole('button', { name: /Place sample order/ }))

    expect(screen.getByRole('heading', { name: 'Your gift is ready to share' })).toBeTruthy()
    expect(screen.getByText('No payment was taken and no fulfilment request was sent.', { exact: false })).toBeTruthy()
  })
})
