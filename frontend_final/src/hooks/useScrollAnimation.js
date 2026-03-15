import { useEffect, useRef, useState } from 'react'

/**
 * IntersectionObserver hook. Returns { ref, inView }.
 * Attach `ref` to any container element and use `inView` to trigger animations.
 * @param {number} threshold - 0..1, default 0.15
 * @param {boolean} once - if true (default), stops observing after first trigger
 */
export function useScrollAnimation(threshold = 0.15, once = true) {
    const ref = useRef(null)
    const [inView, setInView] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true)
                    if (once) observer.unobserve(el)
                } else if (!once) {
                    setInView(false)
                }
            },
            { threshold }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [threshold, once])

    return { ref, inView }
}
