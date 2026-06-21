import type { College } from '../data/mock'

interface CollegeNameLinkProps {
  college: College
  className?: string
}

export default function CollegeNameLink({ college, className = '' }: CollegeNameLinkProps) {
  const baseClass = `font-bold ${className}`
  if (college.website) {
    return (
      <a
        href={college.website}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClass} text-blue-600 hover:text-blue-800 hover:underline transition-colors`}
        onClick={(e) => e.stopPropagation()}
      >
        {college.name}
      </a>
    )
  }
  return <span className={`${baseClass} text-text-primary`}>{college.name}</span>
}
